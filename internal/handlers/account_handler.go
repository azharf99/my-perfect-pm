package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"my-perfect-pm/internal/middleware"
	"my-perfect-pm/internal/models"
	"my-perfect-pm/internal/security"
)

type AccountHandler struct {
	db   *gorm.DB
	auth *AuthHandler
}

func NewAccountHandler(db *gorm.DB, auth *AuthHandler) *AccountHandler {
	return &AccountHandler{db: db, auth: auth}
}

type UpdateProfileRequest struct {
	FullName  string `json:"full_name" binding:"required,min=1,max=255"`
	AvatarURL string `json:"avatar_url" binding:"omitempty,max=512"`
}

func (h *AccountHandler) UpdateProfile(c *gin.Context) {
	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Full name is required"})
		return
	}
	avatar := strings.TrimSpace(req.AvatarURL)
	if avatar != "" && !strings.HasPrefix(avatar, "https://") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Avatar URL must start with https://"})
		return
	}
	user := middleware.GetUser(c)
	h.db.Model(user).Updates(map[string]interface{}{"full_name": strings.TrimSpace(req.FullName), "avatar_url": avatar})
	c.JSON(http.StatusOK, gin.H{"id": user.ID, "email": user.Email, "full_name": user.FullName, "avatar_url": user.AvatarURL})
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required"`
}

func (h *AccountHandler) ChangePassword(c *gin.Context) {
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Current and new password are required"})
		return
	}
	user := middleware.GetUser(c)
	if !security.CheckPasswordHash(req.CurrentPassword, user.PasswordHash) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Current password is incorrect"})
		return
	}
	if req.CurrentPassword == req.NewPassword {
		c.JSON(http.StatusBadRequest, gin.H{"error": "New password must be different from the current one"})
		return
	}
	if err := security.ValidatePasswordPolicy(req.NewPassword, user.Email); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	hashed, err := security.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process password"})
		return
	}
	// Revoke every existing session, then issue a fresh one for this device.
	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(user).Updates(map[string]interface{}{
			"password_hash": hashed, "must_change_password": false, "token_version": user.TokenVersion + 1,
		}).Error; err != nil {
			return err
		}
		return tx.Model(&models.RefreshToken{}).Where("user_id = ?", user.ID).Update("revoked", true).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to change password"})
		return
	}
	if err := h.auth.issueSession(c, user, middleware.GetTenantID(c), middleware.GetUserRole(c)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Password changed, please sign in again"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Password changed. Other devices have been signed out."})
}

// ---------- 2FA ----------

func (h *AccountHandler) Setup2FA(c *gin.Context) {
	user := middleware.GetUser(c)
	if user.TOTPEnabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Two-factor authentication is already enabled"})
		return
	}
	secret, qr, url, err := security.GenerateTOTP(user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate 2FA secret"})
		return
	}
	enc, err := security.Encrypt(secret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to secure 2FA secret"})
		return
	}
	// Store pending secret (not enabled until verified).
	h.db.Model(user).Updates(map[string]interface{}{"totp_secret_enc": enc, "totp_last_step": 0})
	c.JSON(http.StatusOK, gin.H{"qr_code": qr, "secret": secret, "otpauth_url": url})
}

type CodeRequest struct {
	Code string `json:"code" binding:"required"`
}

func (h *AccountHandler) generateRecoveryCodes(tx *gorm.DB, userID string) ([]string, error) {
	codes, err := security.GenerateRecoveryCodes(10)
	if err != nil {
		return nil, err
	}
	if err := tx.Unscoped().Where("user_id = ?", userID).Delete(&models.RecoveryCode{}).Error; err != nil {
		return nil, err
	}
	for _, code := range codes {
		hash, err := security.HashPassword(code)
		if err != nil {
			return nil, err
		}
		if err := tx.Create(&models.RecoveryCode{UserID: userID, CodeHash: hash}).Error; err != nil {
			return nil, err
		}
	}
	return codes, nil
}

func (h *AccountHandler) Enable2FA(c *gin.Context) {
	var req CodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Verification code is required"})
		return
	}
	user := middleware.GetUser(c)
	if user.TOTPEnabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Two-factor authentication is already enabled"})
		return
	}
	if user.TOTPSecretEnc == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Start 2FA setup first"})
		return
	}
	secret, err := security.Decrypt(user.TOTPSecretEnc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read 2FA secret"})
		return
	}
	step, ok := security.ValidateTOTP(secret, req.Code, 0)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid verification code. Check your device clock and try again."})
		return
	}
	var codes []string
	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(user).Updates(map[string]interface{}{"totp_enabled": true, "totp_last_step": step}).Error; err != nil {
			return err
		}
		var e error
		codes, e = h.generateRecoveryCodes(tx, user.ID)
		return e
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to enable 2FA"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"recovery_codes": codes})
}

type PasswordAndCodeRequest struct {
	Password string `json:"password" binding:"required"`
	Code     string `json:"code" binding:"required"`
}

func (h *AccountHandler) verifyPasswordAndCode(c *gin.Context) (*models.User, bool) {
	var req PasswordAndCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password and verification code are required"})
		return nil, false
	}
	user := middleware.GetUser(c)
	if !user.TOTPEnabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Two-factor authentication is not enabled"})
		return nil, false
	}
	if !security.CheckPasswordHash(req.Password, user.PasswordHash) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password is incorrect"})
		return nil, false
	}
	if !verifySecondFactor(h.db, user, req.Code, "") {
		status, body := mfaFailure(h.db, user)
		c.JSON(status, body)
		return nil, false
	}
	return user, true
}

func (h *AccountHandler) Disable2FA(c *gin.Context) {
	user, ok := h.verifyPasswordAndCode(c)
	if !ok {
		return
	}
	var enforcing int64
	h.db.Model(&models.OrganizationMember{}).
		Joins("JOIN organizations ON organizations.id = organization_members.organization_id").
		Where("organization_members.user_id = ? AND organizations.enforce_2fa = ?", user.ID, true).
		Count(&enforcing)
	if enforcing > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A workspace you belong to requires 2FA, so it cannot be disabled"})
		return
	}
	h.db.Transaction(func(tx *gorm.DB) error {
		tx.Model(user).Updates(map[string]interface{}{"totp_enabled": false, "totp_secret_enc": "", "totp_last_step": 0})
		return tx.Unscoped().Where("user_id = ?", user.ID).Delete(&models.RecoveryCode{}).Error
	})
	c.JSON(http.StatusOK, gin.H{"message": "Two-factor authentication disabled"})
}

func (h *AccountHandler) RegenerateRecoveryCodes(c *gin.Context) {
	user, ok := h.verifyPasswordAndCode(c)
	if !ok {
		return
	}
	var codes []string
	err := h.db.Transaction(func(tx *gorm.DB) error {
		var e error
		codes, e = h.generateRecoveryCodes(tx, user.ID)
		return e
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to regenerate codes"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"recovery_codes": codes})
}

func (h *AccountHandler) RecoveryCodesStatus(c *gin.Context) {
	user := middleware.GetUser(c)
	var remaining int64
	h.db.Model(&models.RecoveryCode{}).Where("user_id = ? AND used_at IS NULL", user.ID).Count(&remaining)
	c.JSON(http.StatusOK, gin.H{"remaining": remaining, "totp_enabled": user.TOTPEnabled})
}

// ---------- Sessions ----------

func currentRefreshHash(c *gin.Context) string {
	// The refresh cookie is path-scoped to /api/v1/auth, so the frontend passes
	// nothing here; we identify the current session by most recent use instead.
	if raw, err := c.Cookie("refresh_token"); err == nil && raw != "" {
		return security.HashToken(raw)
	}
	return ""
}

func (h *AccountHandler) ListSessions(c *gin.Context) {
	user := middleware.GetUser(c)
	var sessions []models.RefreshToken
	h.db.Where("user_id = ? AND revoked = ? AND expires_at > ?", user.ID, false, time.Now()).
		Order("last_used_at DESC").Find(&sessions)
	cur := currentRefreshHash(c)
	out := make([]gin.H, 0, len(sessions))
	for i, s := range sessions {
		isCurrent := (cur != "" && s.TokenHash == cur) || (cur == "" && i == 0)
		out = append(out, gin.H{
			"id": s.ID, "user_agent": s.UserAgent, "ip": s.IP,
			"created_at": s.CreatedAt, "last_used_at": s.LastUsedAt, "current": isCurrent,
		})
	}
	c.JSON(http.StatusOK, out)
}

func (h *AccountHandler) RevokeSession(c *gin.Context) {
	user := middleware.GetUser(c)
	res := h.db.Model(&models.RefreshToken{}).Where("id = ? AND user_id = ?", c.Param("id"), user.ID).Update("revoked", true)
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Session revoked"})
}

// RevokeOtherSessions bumps token_version (kills every access token) and
// revokes all refresh tokens, then issues a fresh session for this device.
func (h *AccountHandler) RevokeOtherSessions(c *gin.Context) {
	user := middleware.GetUser(c)
	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(user).Update("token_version", user.TokenVersion+1).Error; err != nil {
			return err
		}
		return tx.Model(&models.RefreshToken{}).Where("user_id = ?", user.ID).Update("revoked", true).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke sessions"})
		return
	}
	if err := h.auth.issueSession(c, user, middleware.GetTenantID(c), middleware.GetUserRole(c)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Please sign in again"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "All other devices have been signed out"})
}

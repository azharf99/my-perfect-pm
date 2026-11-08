package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"my-perfect-pm/internal/config"
	"my-perfect-pm/internal/middleware"
	"my-perfect-pm/internal/models"
	"my-perfect-pm/internal/security"
)

const (
	accessTTL       = 60 * time.Minute
	refreshTTL      = 7 * 24 * time.Hour
	mfaMaxAttempts  = 5
	mfaLockDuration = 15 * time.Minute
)

type AuthHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewAuthHandler(db *gorm.DB, cfg *config.Config) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg}
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type Login2FARequest struct {
	Code         string `json:"code"`
	RecoveryCode string `json:"recovery_code"`
}

type RegisterRequest struct {
	Email         string `json:"email" binding:"required,email,max=255"`
	Password      string `json:"password" binding:"required"`
	FullName      string `json:"full_name" binding:"required,max=255"`
	WorkspaceName string `json:"workspace_name" binding:"required,max=255"`
}

func (h *AuthHandler) secure() bool { return h.cfg.Environment == "production" }

func (h *AuthHandler) setCookie(c *gin.Context, name, value string, maxAge int, path string, httpOnly bool) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(name, value, maxAge, path, "", h.secure(), httpOnly)
}

// issueSession creates access + refresh tokens for user in tenant and sets cookies.
func (h *AuthHandler) issueSession(c *gin.Context, user *models.User, tenantID, role string) error {
	access, err := security.GenerateAccessToken(user.ID, user.Email, tenantID, role, user.TokenVersion, h.cfg.JWTSecret, accessTTL)
	if err != nil {
		return err
	}
	raw := security.GenerateRefreshTokenString()
	ua := c.Request.UserAgent()
	if len(ua) > 255 {
		ua = ua[:255]
	}
	if err := h.db.Create(&models.RefreshToken{
		UserID:     user.ID,
		TokenHash:  security.HashToken(raw),
		ExpiresAt:  time.Now().Add(refreshTTL),
		UserAgent:  ua,
		IP:         c.ClientIP(),
		LastUsedAt: time.Now(),
	}).Error; err != nil {
		return err
	}
	csrf, _ := security.GenerateCSRFToken()
	h.setCookie(c, "access_token", access, int(accessTTL.Seconds()), "/", true)
	h.setCookie(c, "refresh_token", raw, int(refreshTTL.Seconds()), "/api/v1/auth", true)
	h.setCookie(c, "csrf_token", csrf, int(refreshTTL.Seconds()), "/", false)
	return nil
}

func (h *AuthHandler) clearSession(c *gin.Context) {
	h.setCookie(c, "access_token", "", -1, "/", true)
	h.setCookie(c, "refresh_token", "", -1, "/api/v1/auth", true)
	h.setCookie(c, "mfa_token", "", -1, "/api/v1/auth", true)
}

func (h *AuthHandler) primaryMembership(userID string) (*models.OrganizationMember, error) {
	var m models.OrganizationMember
	err := h.db.Where("user_id = ?", userID).Preload("Organization").Order("created_at ASC").First(&m).Error
	return &m, err
}

func (h *AuthHandler) completeLogin(c *gin.Context, user *models.User) {
	member, err := h.primaryMembership(user.ID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Your account is not a member of any workspace"})
		return
	}
	if err := h.issueSession(c, user, member.OrganizationID, member.Role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}
	now := time.Now()
	h.db.Model(user).Updates(map[string]interface{}{"last_login_at": now, "failed_mfa_attempts": 0, "mfa_locked_until": nil})
	c.JSON(http.StatusOK, gin.H{"mfa_required": false})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email or password"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	if err := h.db.Where("email = ?", email).First(&user).Error; err != nil {
		security.DummyPasswordCheck(req.Password)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}
	if !security.CheckPasswordHash(req.Password, user.PasswordHash) || !user.IsActive {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	if user.TOTPEnabled {
		tok, err := security.GenerateMFAPendingToken(user.ID, user.TokenVersion, h.cfg.JWTSecret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start 2FA"})
			return
		}
		h.setCookie(c, "mfa_token", tok, 300, "/api/v1/auth", true)
		c.JSON(http.StatusOK, gin.H{"mfa_required": true})
		return
	}
	h.completeLogin(c, &user)
}

func (h *AuthHandler) Login2FA(c *gin.Context) {
	tok, err := c.Cookie("mfa_token")
	if err != nil || tok == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "2FA session expired, please sign in again", "code": "MFA_SESSION_EXPIRED"})
		return
	}
	claims, err := security.ValidateMFAPendingToken(tok, h.cfg.JWTSecret)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "2FA session expired, please sign in again", "code": "MFA_SESSION_EXPIRED"})
		return
	}
	var req Login2FARequest
	if err := c.ShouldBindJSON(&req); err != nil || (req.Code == "" && req.RecoveryCode == "") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Provide a 6-digit code or a recovery code"})
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", claims.UserID).Error; err != nil || !user.IsActive || !user.TOTPEnabled || user.TokenVersion != claims.TokenVersion {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "2FA session expired, please sign in again", "code": "MFA_SESSION_EXPIRED"})
		return
	}

	ok := verifySecondFactor(h.db, &user, req.Code, req.RecoveryCode)
	if !ok {
		status, body := mfaFailure(h.db, &user)
		c.JSON(status, body)
		return
	}
	h.setCookie(c, "mfa_token", "", -1, "/api/v1/auth", true)
	h.completeLogin(c, &user)
}

// verifySecondFactor checks lockout, then a TOTP code or a recovery code.
// On TOTP success it records the step to prevent replay.
func verifySecondFactor(db *gorm.DB, user *models.User, code, recovery string) bool {
	if user.MFALockedUntil != nil && user.MFALockedUntil.After(time.Now()) {
		return false
	}
	if code != "" {
		secret, err := security.Decrypt(user.TOTPSecretEnc)
		if err != nil {
			return false
		}
		step, ok := security.ValidateTOTP(secret, code, user.TOTPLastStep)
		if !ok {
			return false
		}
		user.TOTPLastStep = step
		db.Model(user).Update("totp_last_step", step)
		return true
	}
	if recovery != "" {
		norm := security.NormalizeRecoveryCode(recovery)
		var codes []models.RecoveryCode
		db.Where("user_id = ? AND used_at IS NULL", user.ID).Find(&codes)
		for i := range codes {
			if security.CheckPasswordHash(norm, codes[i].CodeHash) {
				now := time.Now()
				db.Model(&codes[i]).Update("used_at", now)
				return true
			}
		}
	}
	return false
}

func mfaFailure(db *gorm.DB, user *models.User) (int, gin.H) {
	if user.MFALockedUntil != nil && user.MFALockedUntil.After(time.Now()) {
		return http.StatusTooManyRequests, gin.H{"error": "Too many failed attempts. Try again later.", "code": "MFA_LOCKED"}
	}
	attempts := user.FailedMFAAttempts + 1
	updates := map[string]interface{}{"failed_mfa_attempts": attempts}
	if attempts >= mfaMaxAttempts {
		until := time.Now().Add(mfaLockDuration)
		updates["mfa_locked_until"] = until
		updates["failed_mfa_attempts"] = 0
		db.Model(user).Updates(updates)
		return http.StatusTooManyRequests, gin.H{"error": "Too many failed attempts. Try again in 15 minutes.", "code": "MFA_LOCKED"}
	}
	db.Model(user).Updates(updates)
	return http.StatusUnauthorized, gin.H{"error": "Invalid verification code", "code": "MFA_INVALID"}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please fill in all fields with a valid email"})
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if err := security.ValidatePasswordPolicy(req.Password, req.Email); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existing models.User
	if err := h.db.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Unable to register with this email"})
		return
	}

	hashed, err := security.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process password"})
		return
	}

	var newUser models.User
	err = h.db.Transaction(func(tx *gorm.DB) error {
		newUser = models.User{Email: req.Email, PasswordHash: hashed, FullName: strings.TrimSpace(req.FullName), IsActive: true}
		if err := tx.Create(&newUser).Error; err != nil {
			return err
		}
		slug := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(req.WorkspaceName), " ", "-"))
		org := models.Organization{Name: strings.TrimSpace(req.WorkspaceName), Slug: slug + "-" + newUser.ID[:6]}
		if err := tx.Create(&org).Error; err != nil {
			return err
		}
		return tx.Create(&models.OrganizationMember{OrganizationID: org.ID, UserID: newUser.ID, Role: middleware.RoleAdmin}).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create workspace"})
		return
	}
	h.completeLogin(c, &newUser)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	raw, err := c.Cookie("refresh_token")
	if err != nil || raw == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing refresh token"})
		return
	}
	var rec models.RefreshToken
	if err := h.db.Where("token_hash = ?", security.HashToken(raw)).First(&rec).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Refresh token invalid"})
		return
	}
	if rec.Revoked {
		// Reuse of a rotated token: likely theft. Revoke every session of this user.
		h.db.Model(&models.RefreshToken{}).Where("user_id = ?", rec.UserID).Update("revoked", true)
		h.db.Model(&models.User{}).Where("id = ?", rec.UserID).UpdateColumn("token_version", gorm.Expr("token_version + 1"))
		h.clearSession(c)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Session revoked"})
		return
	}
	if rec.ExpiresAt.Before(time.Now()) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Refresh token expired"})
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", rec.UserID).Error; err != nil || !user.IsActive {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Session is no longer valid"})
		return
	}

	// Keep the tenant the user was working in, if still a member.
	tenantID := c.GetHeader("X-Tenant-ID")
	var member models.OrganizationMember
	q := h.db.Where("user_id = ?", user.ID)
	if tenantID != "" {
		q = q.Where("organization_id = ?", tenantID)
	}
	if err := q.Order("created_at ASC").First(&member).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "No workspace membership"})
		return
	}

	h.db.Model(&rec).Update("revoked", true)
	if err := h.issueSession(c, &user, member.OrganizationID, member.Role); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to refresh session"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Token refreshed"})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	if raw, err := c.Cookie("refresh_token"); err == nil && raw != "" {
		h.db.Model(&models.RefreshToken{}).Where("token_hash = ?", security.HashToken(raw)).Update("revoked", true)
	}
	h.clearSession(c)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out"})
}

func (h *AuthHandler) Me(c *gin.Context) {
	user := middleware.GetUser(c)
	tenantID := middleware.GetTenantID(c)

	var members []models.OrganizationMember
	h.db.Where("user_id = ?", user.ID).Preload("Organization").Find(&members)

	var current *models.Organization
	for _, m := range members {
		if m.OrganizationID == tenantID {
			current = m.Organization
		}
	}
	mustSetup2FA := current != nil && current.Enforce2FA && !user.TOTPEnabled

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":                   user.ID,
			"email":                user.Email,
			"full_name":            user.FullName,
			"avatar_url":           user.AvatarURL,
			"totp_enabled":         user.TOTPEnabled,
			"must_change_password": user.MustChangePassword,
			"must_setup_2fa":       mustSetup2FA,
			"last_login_at":        user.LastLoginAt,
		},
		"organization":  current,
		"organizations": members,
		"role":          middleware.GetUserRole(c),
	})
}

func (h *AuthHandler) GetCSRF(c *gin.Context) {
	token, err := c.Cookie("csrf_token")
	if err != nil || token == "" {
		token, _ = security.GenerateCSRFToken()
		h.setCookie(c, "csrf_token", token, int(refreshTTL.Seconds()), "/", false)
	}
	c.JSON(http.StatusOK, gin.H{"csrf_token": token})
}

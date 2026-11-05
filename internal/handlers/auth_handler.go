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

type RegisterRequest struct {
	Email        string `json:"email" binding:"required,email"`
	Password     string `json:"password" binding:"required,min=6"`
	FullName     string `json:"full_name" binding:"required"`
	WorkspaceName string `json:"workspace_name" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid login credentials format"})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	if err := h.db.Where("email = ? AND is_active = ?", req.Email, true).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	if !security.CheckPasswordHash(req.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Find default/first organization member
	var member models.OrganizationMember
	if err := h.db.Where("user_id = ?", user.ID).Preload("Organization").First(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No workspace found for user"})
		return
	}

	// Generate Access Token (60 min)
	accessToken, err := security.GenerateAccessToken(user.ID, user.Email, member.OrganizationID, member.Role, h.cfg.JWTSecret, 60*time.Minute)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create access token"})
		return
	}

	// Generate Refresh Token (7 days)
	rawRefreshToken := security.GenerateRefreshTokenString()
	refreshTokenHash := security.HashToken(rawRefreshToken)
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	dbRefreshToken := models.RefreshToken{
		UserID:    user.ID,
		TokenHash: refreshTokenHash,
		ExpiresAt: expiresAt,
		Revoked:   false,
	}
	if err := h.db.Create(&dbRefreshToken).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store session"})
		return
	}

	// Generate CSRF token
	csrfToken, _ := security.GenerateCSRFToken()

	// Set HttpOnly Cookies
	isSecure := h.cfg.Environment == "production"
	c.SetCookie("access_token", accessToken, 3600, "/", "", isSecure, true)
	c.SetCookie("refresh_token", rawRefreshToken, 7*86400, "/api/v1/auth", "", isSecure, true)
	c.SetCookie("csrf_token", csrfToken, 7*86400, "/", "", isSecure, false)

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":         user.ID,
			"email":      user.Email,
			"full_name":  user.FullName,
			"avatar_url": user.AvatarURL,
		},
		"organization": member.Organization,
		"role":         member.Role,
		"csrf_token":   csrfToken,
	})
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var existing models.User
	if err := h.db.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email is already registered"})
		return
	}

	hashedPassword, err := security.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process password"})
		return
	}

	// Transaction: Create User, Organization, and Member
	tx := h.db.Begin()

	newUser := models.User{
		Email:        req.Email,
		PasswordHash: hashedPassword,
		FullName:     req.FullName,
		IsActive:     true,
	}
	if err := tx.Create(&newUser).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	slug := strings.ToLower(strings.ReplaceAll(req.WorkspaceName, " ", "-"))
	org := models.Organization{
		Name: req.WorkspaceName,
		Slug: slug + "-" + newUser.ID[:6],
	}
	if err := tx.Create(&org).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create organization"})
		return
	}

	member := models.OrganizationMember{
		OrganizationID: org.ID,
		UserID:         newUser.ID,
		Role:           "admin",
	}
	if err := tx.Create(&member).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign workspace membership"})
		return
	}

	tx.Commit()

	// Automatically login user
	accessToken, _ := security.GenerateAccessToken(newUser.ID, newUser.Email, org.ID, "admin", h.cfg.JWTSecret, 60*time.Minute)
	rawRefreshToken := security.GenerateRefreshTokenString()
	refreshTokenHash := security.HashToken(rawRefreshToken)
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	h.db.Create(&models.RefreshToken{
		UserID:    newUser.ID,
		TokenHash: refreshTokenHash,
		ExpiresAt: expiresAt,
	})

	csrfToken, _ := security.GenerateCSRFToken()
	isSecure := h.cfg.Environment == "production"
	c.SetCookie("access_token", accessToken, 3600, "/", "", isSecure, true)
	c.SetCookie("refresh_token", rawRefreshToken, 7*86400, "/api/v1/auth", "", isSecure, true)
	c.SetCookie("csrf_token", csrfToken, 7*86400, "/", "", isSecure, false)

	c.JSON(http.StatusCreated, gin.H{
		"user": gin.H{
			"id":        newUser.ID,
			"email":     newUser.Email,
			"full_name": newUser.FullName,
		},
		"organization": org,
		"role":         "admin",
		"csrf_token":   csrfToken,
	})
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	rawRefreshToken, err := c.Cookie("refresh_token")
	if err != nil || rawRefreshToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing refresh token"})
		return
	}

	hash := security.HashToken(rawRefreshToken)
	var tokenRecord models.RefreshToken
	if err := h.db.Where("token_hash = ? AND revoked = ? AND expires_at > ?", hash, false, time.Now()).First(&tokenRecord).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Refresh token invalid or expired"})
		return
	}

	// Fetch user & member
	var user models.User
	if err := h.db.First(&user, "id = ?", tokenRecord.UserID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	var member models.OrganizationMember
	if err := h.db.Where("user_id = ?", user.ID).First(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Membership error"})
		return
	}

	// Invalidate old refresh token (Token rotation!)
	tokenRecord.Revoked = true
	h.db.Save(&tokenRecord)

	// Issue new tokens
	newAccessToken, err := security.GenerateAccessToken(user.ID, user.Email, member.OrganizationID, member.Role, h.cfg.JWTSecret, 60*time.Minute)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	newRawRefreshToken := security.GenerateRefreshTokenString()
	newHash := security.HashToken(newRawRefreshToken)
	h.db.Create(&models.RefreshToken{
		UserID:    user.ID,
		TokenHash: newHash,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
	})

	isSecure := h.cfg.Environment == "production"
	c.SetCookie("access_token", newAccessToken, 3600, "/", "", isSecure, true)
	c.SetCookie("refresh_token", newRawRefreshToken, 7*86400, "/api/v1/auth", "", isSecure, true)

	c.JSON(http.StatusOK, gin.H{
		"message": "Token refreshed successfully",
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	if rawRefreshToken, err := c.Cookie("refresh_token"); err == nil && rawRefreshToken != "" {
		hash := security.HashToken(rawRefreshToken)
		h.db.Model(&models.RefreshToken{}).Where("token_hash = ?", hash).Update("revoked", true)
	}

	isSecure := h.cfg.Environment == "production"
	c.SetCookie("access_token", "", -1, "/", "", isSecure, true)
	c.SetCookie("refresh_token", "", -1, "/api/v1/auth", "", isSecure, true)

	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID := middleware.GetUserID(c)
	tenantID := middleware.GetTenantID(c)

	var user models.User
	if err := h.db.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var members []models.OrganizationMember
	h.db.Where("user_id = ?", userID).Preload("Organization").Find(&members)

	var currentOrg *models.Organization
	currentRole := "member"
	for _, m := range members {
		if m.OrganizationID == tenantID {
			currentOrg = m.Organization
			currentRole = m.Role
			break
		}
	}
	if currentOrg == nil && len(members) > 0 {
		currentOrg = members[0].Organization
		currentRole = members[0].Role
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":         user.ID,
			"email":      user.Email,
			"full_name":  user.FullName,
			"avatar_url": user.AvatarURL,
		},
		"organization":  currentOrg,
		"organizations": members,
		"role":          currentRole,
	})
}

func (h *AuthHandler) GetCSRF(c *gin.Context) {
	cookieToken, err := c.Cookie("csrf_token")
	if err != nil || cookieToken == "" {
		newToken, _ := security.GenerateCSRFToken()
		isSecure := h.cfg.Environment == "production"
		c.SetCookie("csrf_token", newToken, 7*86400, "/", "", isSecure, false)
		cookieToken = newToken
	}

	c.JSON(http.StatusOK, gin.H{
		"csrf_token": cookieToken,
	})
}

package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"my-perfect-pm/internal/models"
	"my-perfect-pm/internal/security"
)

const (
	ContextUserID   = "userID"
	ContextTenantID = "tenantID"
	ContextRole     = "role"
	ContextEmail    = "email"
	ContextUser     = "user"
	ContextOrg      = "org"
)

// Paths reachable while a forced flow (password change / 2FA setup) is pending.
var gateAllowAlways = []string{
	"/api/v1/auth/me",
	"/api/v1/auth/logout",
	"/api/v1/auth/csrf",
	"/api/v1/account/password",
}

func pathAllowed(path string, prefixes []string) bool {
	for _, p := range prefixes {
		if path == p || strings.HasPrefix(path, p+"/") {
			return true
		}
	}
	return false
}

// Auth validates the JWT, enforces token version, active status, tenant
// membership (role loaded from DB, never trusted from the token or headers)
// and the forced password-change / 2FA-setup gates.
func Auth(db *gorm.DB, jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string
		if cookie, err := c.Cookie("access_token"); err == nil && cookie != "" {
			tokenString = cookie
		}
		if tokenString == "" {
			if h := c.GetHeader("Authorization"); strings.HasPrefix(h, "Bearer ") {
				tokenString = strings.TrimPrefix(h, "Bearer ")
			}
		}
		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}

		claims, err := security.ValidateAccessToken(tokenString, jwtSecret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		var user models.User
		if err := db.First(&user, "id = ?", claims.UserID).Error; err != nil || !user.IsActive || user.TokenVersion != claims.TokenVersion {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Session is no longer valid"})
			return
		}

		// Resolve active tenant: header override must be backed by membership.
		tenantID := claims.TenantID
		if h := c.GetHeader("X-Tenant-ID"); h != "" {
			tenantID = h
		}
		var member models.OrganizationMember
		if err := db.Preload("Organization").
			Where("organization_id = ? AND user_id = ?", tenantID, user.ID).
			First(&member).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "You are not a member of this workspace", "code": "NOT_A_MEMBER"})
			return
		}

		c.Set(ContextUserID, user.ID)
		c.Set(ContextTenantID, tenantID)
		c.Set(ContextRole, member.Role)
		c.Set(ContextEmail, user.Email)
		c.Set(ContextUser, &user)
		if member.Organization != nil {
			c.Set(ContextOrg, member.Organization)
		}

		path := c.FullPath()
		if user.MustChangePassword && !pathAllowed(path, gateAllowAlways) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "You must change your password first", "code": "PASSWORD_CHANGE_REQUIRED"})
			return
		}
		if member.Organization != nil && member.Organization.Enforce2FA && !user.TOTPEnabled &&
			!pathAllowed(path, append(gateAllowAlways, "/api/v1/account/2fa")) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "This workspace requires two-factor authentication", "code": "MFA_SETUP_REQUIRED"})
			return
		}

		c.Next()
	}
}

func GetUserID(c *gin.Context) string   { return c.GetString(ContextUserID) }
func GetTenantID(c *gin.Context) string { return c.GetString(ContextTenantID) }
func GetUserRole(c *gin.Context) string { return c.GetString(ContextRole) }

func GetUser(c *gin.Context) *models.User {
	if v, ok := c.Get(ContextUser); ok {
		if u, ok := v.(*models.User); ok {
			return u
		}
	}
	return nil
}

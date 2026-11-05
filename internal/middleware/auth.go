package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"my-perfect-pm/internal/security"
)

const (
	ContextUserID   = "userID"
	ContextTenantID = "tenantID"
	ContextRole     = "role"
	ContextEmail    = "email"
)

func Auth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		// 1. Try reading from HttpOnly cookie
		if cookie, err := c.Cookie("access_token"); err == nil && cookie != "" {
			tokenString = cookie
		}

		// 2. Fallback to Authorization: Bearer <token> header
		if tokenString == "" {
			authHeader := c.GetHeader("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				tokenString = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}

		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Authentication required. Missing token.",
			})
			return
		}

		claims, err := security.ValidateAccessToken(tokenString, jwtSecret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid or expired token.",
			})
			return
		}

		// If user passes X-Tenant-ID header, verify or allow workspace switching
		tenantID := claims.TenantID
		if customTenant := c.GetHeader("X-Tenant-ID"); customTenant != "" {
			tenantID = customTenant
		}

		c.Set(ContextUserID, claims.UserID)
		c.Set(ContextTenantID, tenantID)
		c.Set(ContextRole, claims.Role)
		c.Set(ContextEmail, claims.Email)

		c.Next()
	}
}

func GetUserID(c *gin.Context) string {
	if val, exists := c.Get(ContextUserID); exists {
		if s, ok := val.(string); ok {
			return s
		}
	}
	return ""
}

func GetTenantID(c *gin.Context) string {
	if val, exists := c.Get(ContextTenantID); exists {
		if s, ok := val.(string); ok {
			return s
		}
	}
	return ""
}

func GetUserRole(c *gin.Context) string {
	if val, exists := c.Get(ContextRole); exists {
		if s, ok := val.(string); ok {
			return s
		}
	}
	return ""
}

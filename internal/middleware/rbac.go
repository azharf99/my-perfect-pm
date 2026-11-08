package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

const (
	RoleAdmin  = "admin"
	RoleMember = "member"
	RoleViewer = "viewer"
)

func IsValidRole(r string) bool {
	return r == RoleAdmin || r == RoleMember || r == RoleViewer
}

// RequireRole allows only the listed roles.
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := GetUserRole(c)
		for _, r := range roles {
			if r == role {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions", "code": "FORBIDDEN"})
	}
}

// RequireWrite blocks viewers from any state-changing request.
func RequireWrite() gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			c.Next()
			return
		}
		if GetUserRole(c) == RoleViewer {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Viewers have read-only access", "code": "READ_ONLY"})
			return
		}
		c.Next()
	}
}

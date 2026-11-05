package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"my-perfect-pm/internal/security"
)

func CSRFProtection() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Ensure a CSRF cookie exists for GET/HEAD/OPTIONS so the frontend can read it
		cookieToken, err := c.Cookie("csrf_token")
		if err != nil || cookieToken == "" {
			newToken, genErr := security.GenerateCSRFToken()
			if genErr == nil {
				// Non-HttpOnly so client-side Axios can read it and send back in X-CSRF-Token header
				c.SetCookie("csrf_token", newToken, 86400*7, "/", "", false, false)
				cookieToken = newToken
			}
		}

		// Safe HTTP methods do not mutate state
		if c.Request.Method == http.MethodGet ||
			c.Request.Method == http.MethodHead ||
			c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}

		// For mutating requests (POST, PUT, PATCH, DELETE), verify X-CSRF-Token header against cookie
		headerToken := c.GetHeader("X-CSRF-Token")
		if err := security.ValidateCSRF(cookieToken, headerToken); err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "CSRF verification failed: " + err.Error(),
			})
			return
		}

		c.Next()
	}
}

package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"

	"my-perfect-pm/internal/config"
	"my-perfect-pm/internal/database"
	"my-perfect-pm/internal/handlers"
	"my-perfect-pm/internal/middleware"
	"my-perfect-pm/internal/models"
	"my-perfect-pm/internal/security"
)

func setupTestServer(t *testing.T) (*gin.Engine, *handlers.AuthHandler, func()) {
	gin.SetMode(gin.TestMode)
	testDBPath := "test_pm.db"
	_ = os.Remove(testDBPath)

	cfg := &config.Config{
		Port:               "8080",
		DBPath:             testDBPath,
		JWTSecret:          "test-jwt-secret-very-secure-key-12345",
		Environment:        "development",
		CORSAllowedOrigins: "*",
		RateLimitRequests:  1000,
		AdminEmail:         "admin@myperfectpm.local",
		AdminPassword:      "Admin123!",
	}

	_ = security.InitEncryption("", cfg.JWTSecret)

	db, err := database.InitDB(cfg.DBPath)
	if err != nil {
		t.Fatalf("Failed to init test db: %v", err)
	}

	if err := database.SeedInitialData(db); err != nil {
		t.Fatalf("Failed to seed test db: %v", err)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.SecurityHeaders())
	r.Use(middleware.CSRFProtection())

	authH := handlers.NewAuthHandler(db, cfg)
	accountH := handlers.NewAccountHandler(db, authH)
	memberH := handlers.NewMemberHandler(db)
	workspaceH := handlers.NewWorkspaceHandler(db)
	projH := handlers.NewProjectHandler(db)
	sprintH := handlers.NewSprintHandler(db)
	issueH := handlers.NewIssueHandler(db)
	subtaskH := handlers.NewSubtaskHandler(db)
	commentH := handlers.NewCommentHandler(db)
	analyticsH := handlers.NewAnalyticsHandler(db)

	api := r.Group("/api/v1")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/login", authH.Login)
			auth.POST("/login/2fa", authH.Login2FA)
			auth.GET("/csrf", authH.GetCSRF)
		}

		protected := api.Group("")
		protected.Use(middleware.Auth(db, cfg.JWTSecret))
		{
			protected.GET("/auth/me", authH.Me)

			account := protected.Group("/account")
			{
				account.PATCH("/profile", middleware.RequireWrite(), accountH.UpdateProfile)
				account.POST("/password", middleware.RequireWrite(), accountH.ChangePassword)
				account.POST("/2fa/setup", middleware.RequireWrite(), accountH.Setup2FA)
				account.POST("/2fa/enable", middleware.RequireWrite(), accountH.Enable2FA)
			}

			protected.GET("/members", memberH.List)
			adminMembers := protected.Group("/members")
			adminMembers.Use(middleware.RequireRole(middleware.RoleAdmin))
			{
				adminMembers.POST("", memberH.Add)
				adminMembers.PATCH("/:userId", memberH.UpdateRole)
				adminMembers.POST("/:userId/deactivate", memberH.Deactivate)
			}

			workspace := protected.Group("/workspace")
			{
				workspace.GET("", workspaceH.Get)
				workspace.PATCH("", middleware.RequireRole(middleware.RoleAdmin), workspaceH.Update)
			}

			protected.GET("/projects", projH.List)
			protected.POST("/projects", middleware.RequireWrite(), projH.Create)
			protected.GET("/projects/:id", projH.Get)
			protected.PUT("/projects/:id", middleware.RequireWrite(), projH.Update)
			protected.DELETE("/projects/:id", middleware.RequireWrite(), projH.Delete)

			protected.GET("/projects/:id/sprints", sprintH.ListByProject)
			protected.GET("/issues", issueH.List)
			protected.POST("/issues", middleware.RequireWrite(), issueH.Create)
			protected.POST("/issues/:id/subtasks", middleware.RequireWrite(), subtaskH.Create)
			protected.POST("/issues/:id/comments", middleware.RequireWrite(), commentH.Create)
			protected.GET("/analytics/dashboard", analyticsH.GetDashboard)
		}
	}

	cleanup := func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
		_ = os.Remove(testDBPath)
		_ = os.Remove(testDBPath + "-wal")
		_ = os.Remove(testDBPath + "-shm")
	}

	return r, authH, cleanup
}

func TestAuthAndAgileEndpoints(t *testing.T) {
	r, _, cleanup := setupTestServer(t)
	defer cleanup()

	// 1. Get CSRF Token
	reqCSRF, _ := http.NewRequest(http.MethodGet, "/api/v1/auth/csrf", nil)
	wCSRF := httptest.NewRecorder()
	r.ServeHTTP(wCSRF, reqCSRF)

	if wCSRF.Code != http.StatusOK {
		t.Fatalf("Expected CSRF 200, got %d", wCSRF.Code)
	}

	csrfCookie := ""
	for _, cookie := range wCSRF.Result().Cookies() {
		if cookie.Name == "csrf_token" {
			csrfCookie = cookie.Value
			break
		}
	}
	if csrfCookie == "" {
		t.Fatalf("Expected csrf_token cookie to be set")
	}

	// 2. Login as Demo Admin
	loginBody, _ := json.Marshal(map[string]string{
		"email":    "admin@myperfectpm.local",
		"password": "Admin123!",
	})
	reqLogin, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBuffer(loginBody))
	reqLogin.Header.Set("Content-Type", "application/json")
	reqLogin.Header.Set("X-CSRF-Token", csrfCookie)
	reqLogin.AddCookie(&http.Cookie{Name: "csrf_token", Value: csrfCookie})

	wLogin := httptest.NewRecorder()
	r.ServeHTTP(wLogin, reqLogin)

	if wLogin.Code != http.StatusOK {
		t.Fatalf("Expected login 200, got %d: %s", wLogin.Code, wLogin.Body.String())
	}

	var accessTokenCookie *http.Cookie
	for _, cookie := range wLogin.Result().Cookies() {
		if cookie.Name == "access_token" {
			accessTokenCookie = cookie
			break
		}
	}
	if accessTokenCookie == nil {
		t.Fatalf("Expected access_token HttpOnly cookie to be set")
	}

	// 3. Test Protected Analytics Dashboard
	reqAnalytics, _ := http.NewRequest(http.MethodGet, "/api/v1/analytics/dashboard", nil)
	reqAnalytics.AddCookie(accessTokenCookie)
	wAnalytics := httptest.NewRecorder()
	r.ServeHTTP(wAnalytics, reqAnalytics)

	if wAnalytics.Code != http.StatusOK {
		t.Fatalf("Expected analytics 200, got %d: %s", wAnalytics.Code, wAnalytics.Body.String())
	}

	var analyticsResp struct {
		TotalProjects int `json:"total_projects"`
		TotalIssues   int `json:"total_issues"`
		ActiveSprints int `json:"active_sprints"`
	}
	if err := json.Unmarshal(wAnalytics.Body.Bytes(), &analyticsResp); err != nil {
		t.Fatalf("Failed to parse analytics JSON: %v", err)
	}

	if analyticsResp.TotalProjects != 2 {
		t.Fatalf("Expected 2 seeded projects, got %d", analyticsResp.TotalProjects)
	}
	if analyticsResp.ActiveSprints != 1 {
		t.Fatalf("Expected 1 active sprint, got %d", analyticsResp.ActiveSprints)
	}

	// 4. Test Tenant Isolation: Passing invalid/unauthorized X-Tenant-ID should return 403 NOT_A_MEMBER
	reqFakeTenant, _ := http.NewRequest(http.MethodGet, "/api/v1/projects", nil)
	reqFakeTenant.AddCookie(accessTokenCookie)
	reqFakeTenant.Header.Set("X-Tenant-ID", "rogue-tenant-uuid-12345")
	wFakeTenant := httptest.NewRecorder()
	r.ServeHTTP(wFakeTenant, reqFakeTenant)

	if wFakeTenant.Code != http.StatusForbidden {
		t.Fatalf("Expected 403 Forbidden for unauthorized tenant, got %d", wFakeTenant.Code)
	}

	// 5. Test CSRF Rejection on State-Changing Request without X-CSRF-Token
	newProjBody, _ := json.Marshal(map[string]string{
		"key":  "TEST",
		"name": "Test Project",
	})
	reqNoCSRF, _ := http.NewRequest(http.MethodPost, "/api/v1/projects", bytes.NewBuffer(newProjBody))
	reqNoCSRF.Header.Set("Content-Type", "application/json")
	reqNoCSRF.AddCookie(accessTokenCookie)
	reqNoCSRF.AddCookie(&http.Cookie{Name: "csrf_token", Value: csrfCookie})

	wNoCSRF := httptest.NewRecorder()
	r.ServeHTTP(wNoCSRF, reqNoCSRF)

	if wNoCSRF.Code != http.StatusForbidden {
		t.Fatalf("Expected 403 Forbidden without CSRF header, got %d", wNoCSRF.Code)
	}

	// 6. Test Member Management: Admin adds a new member with generated temp password
	addMemberBody, _ := json.Marshal(map[string]string{
		"email":     "developer@acme.com",
		"full_name": "Dev User",
		"role":      "member",
	})
	reqAddMember, _ := http.NewRequest(http.MethodPost, "/api/v1/members", bytes.NewBuffer(addMemberBody))
	reqAddMember.Header.Set("Content-Type", "application/json")
	reqAddMember.Header.Set("X-CSRF-Token", csrfCookie)
	reqAddMember.AddCookie(accessTokenCookie)
	reqAddMember.AddCookie(&http.Cookie{Name: "csrf_token", Value: csrfCookie})

	wAddMember := httptest.NewRecorder()
	r.ServeHTTP(wAddMember, reqAddMember)

	if wAddMember.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created for adding member, got %d: %s", wAddMember.Code, wAddMember.Body.String())
	}

	var memberResp struct {
		TempPassword string                  `json:"temp_password"`
		Member       models.OrganizationMember `json:"member"`
	}
	if err := json.Unmarshal(wAddMember.Body.Bytes(), &memberResp); err != nil {
		t.Fatalf("Failed to parse add member response: %v", err)
	}
	if memberResp.TempPassword == "" {
		t.Fatalf("Expected temp_password for new member to be non-empty")
	}

	// 7. Test Safety Rule: Cannot demote or deactivate the last admin
	demoteAdminBody, _ := json.Marshal(map[string]string{
		"role": "viewer",
	})
	// Get admin user ID from /auth/me
	reqMe, _ := http.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	reqMe.AddCookie(accessTokenCookie)
	wMe := httptest.NewRecorder()
	r.ServeHTTP(wMe, reqMe)
	var meResp struct {
		User struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	_ = json.Unmarshal(wMe.Body.Bytes(), &meResp)

	reqDemote, _ := http.NewRequest(http.MethodPatch, "/api/v1/members/"+meResp.User.ID, bytes.NewBuffer(demoteAdminBody))
	reqDemote.Header.Set("Content-Type", "application/json")
	reqDemote.Header.Set("X-CSRF-Token", csrfCookie)
	reqDemote.AddCookie(accessTokenCookie)
	reqDemote.AddCookie(&http.Cookie{Name: "csrf_token", Value: csrfCookie})

	wDemote := httptest.NewRecorder()
	r.ServeHTTP(wDemote, reqDemote)

	if wDemote.Code != http.StatusBadRequest {
		t.Fatalf("Expected 400 Bad Request when trying to demote last admin, got %d: %s", wDemote.Code, wDemote.Body.String())
	}
}

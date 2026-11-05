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
)

func setupTestServer(t *testing.T) (*gin.Engine, func()) {
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
	}

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
	projH := handlers.NewProjectHandler(db)
	sprintH := handlers.NewSprintHandler(db)
	issueH := handlers.NewIssueHandler(db)
	analyticsH := handlers.NewAnalyticsHandler(db)

	api := r.Group("/api/v1")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/login", authH.Login)
			auth.GET("/csrf", authH.GetCSRF)
		}

		protected := api.Group("")
		protected.Use(middleware.Auth(cfg.JWTSecret))
		{
			protected.GET("/auth/me", authH.Me)
			protected.GET("/projects", projH.List)
			protected.POST("/projects", projH.Create)
			protected.GET("/projects/:id/sprints", sprintH.ListByProject)
			protected.GET("/issues", issueH.List)
			protected.POST("/issues", issueH.Create)
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

	return r, cleanup
}

func TestAuthAndAgileEndpoints(t *testing.T) {
	r, cleanup := setupTestServer(t)
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

	// 4. Test List Projects
	reqProjects, _ := http.NewRequest(http.MethodGet, "/api/v1/projects", nil)
	reqProjects.AddCookie(accessTokenCookie)
	wProjects := httptest.NewRecorder()
	r.ServeHTTP(wProjects, reqProjects)

	if wProjects.Code != http.StatusOK {
		t.Fatalf("Expected projects list 200, got %d: %s", wProjects.Code, wProjects.Body.String())
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
	// Intentionally omit X-CSRF-Token header!

	wNoCSRF := httptest.NewRecorder()
	r.ServeHTTP(wNoCSRF, reqNoCSRF)

	if wNoCSRF.Code != http.StatusForbidden {
		t.Fatalf("Expected 403 Forbidden without CSRF header, got %d", wNoCSRF.Code)
	}
}

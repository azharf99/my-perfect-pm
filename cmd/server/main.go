package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"my-perfect-pm/internal/config"
	"my-perfect-pm/internal/database"
	"my-perfect-pm/internal/handlers"
	"my-perfect-pm/internal/middleware"
	"my-perfect-pm/internal/security"
)

//go:embed dist/*
var staticFS embed.FS

func main() {
	cfg := config.Load()

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 1. Initialize Encryption (AES-GCM for TOTP secrets)
	if err := security.InitEncryption(cfg.EncryptionKey, cfg.JWTSecret); err != nil {
		log.Fatalf("Encryption initialization failed: %v", err)
	}

	// 2. Initialize SQLite Database
	db, err := database.InitDB(cfg.DBPath)
	if err != nil {
		log.Fatalf("Database initialization failed: %v", err)
	}

	// 3. Auto-seed demo workspace & admin account if empty
	if err := database.SeedInitialData(db); err != nil {
		log.Printf("Warning: Seeding failed: %v", err)
	}

	// 4. Router setup
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.Logger())

	// Security & Networking Middlewares
	r.Use(middleware.SecurityHeaders())
	r.Use(middleware.CORS(cfg.CORSAllowedOrigins))
	rateLimiter := middleware.NewRateLimiter(float64(cfg.RateLimitRequests), float64(cfg.RateLimitRequests)*2)
	r.Use(rateLimiter.Middleware())
	r.Use(middleware.CSRFProtection())

	// Handlers
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

	// API Routes Group
	api := r.Group("/api/v1")
	{
		// Public Auth Routes
		auth := api.Group("/auth")
		{
			auth.POST("/login", authH.Login)
			auth.POST("/login/2fa", authH.Login2FA)
			auth.POST("/register", authH.Register)
			auth.POST("/refresh", authH.Refresh)
			auth.POST("/logout", authH.Logout)
			auth.GET("/csrf", authH.GetCSRF)
		}

		// Protected Routes
		protected := api.Group("")
		protected.Use(middleware.Auth(db, cfg.JWTSecret))
		{
			// Current user info
			protected.GET("/auth/me", authH.Me)

			// Account endpoints (self-service)
			account := protected.Group("/account")
			{
				account.PATCH("/profile", middleware.RequireWrite(), accountH.UpdateProfile)
				account.POST("/password", middleware.RequireWrite(), accountH.ChangePassword)
				account.POST("/2fa/setup", middleware.RequireWrite(), accountH.Setup2FA)
				account.POST("/2fa/enable", middleware.RequireWrite(), accountH.Enable2FA)
				account.POST("/2fa/disable", middleware.RequireWrite(), accountH.Disable2FA)
				account.POST("/2fa/recovery-codes", middleware.RequireWrite(), accountH.RegenerateRecoveryCodes)
				account.GET("/2fa/recovery-codes/status", accountH.RecoveryCodesStatus)
				account.GET("/sessions", accountH.ListSessions)
				account.DELETE("/sessions/:id", accountH.RevokeSession)
				account.POST("/sessions/revoke-others", accountH.RevokeOtherSessions)
			}

			// Members (team)
			protected.GET("/members", memberH.List) // all roles can read members for assignees
			adminMembers := protected.Group("/members")
			adminMembers.Use(middleware.RequireRole(middleware.RoleAdmin))
			{
				adminMembers.POST("", memberH.Add)
				adminMembers.PATCH("/:userId", memberH.UpdateRole)
				adminMembers.POST("/:userId/deactivate", memberH.Deactivate)
				adminMembers.POST("/:userId/activate", memberH.Activate)
				adminMembers.POST("/:userId/reset-password", memberH.ResetPassword)
				adminMembers.POST("/:userId/reset-2fa", memberH.Reset2FA)
				adminMembers.DELETE("/:userId", memberH.Remove)
			}

			// Workspace settings (admin only)
			workspace := protected.Group("/workspace")
			{
				workspace.GET("", workspaceH.Get)
				workspace.PATCH("", middleware.RequireRole(middleware.RoleAdmin), workspaceH.Update)
			}

			// Projects
			protected.GET("/projects", projH.List)
			protected.POST("/projects", middleware.RequireWrite(), projH.Create)
			protected.GET("/projects/:id", projH.Get)
			protected.PUT("/projects/:id", middleware.RequireWrite(), projH.Update)
			protected.DELETE("/projects/:id", middleware.RequireWrite(), projH.Delete)

			// Sprints
			protected.GET("/projects/:id/sprints", sprintH.ListByProject)
			protected.POST("/projects/:id/sprints", middleware.RequireWrite(), sprintH.Create)
			protected.POST("/sprints/:id/start", middleware.RequireWrite(), sprintH.Start)
			protected.POST("/sprints/:id/complete", middleware.RequireWrite(), sprintH.Complete)

			// Issues
			protected.GET("/issues", issueH.List)
			protected.POST("/issues", middleware.RequireWrite(), issueH.Create)
			protected.GET("/issues/:id", issueH.Get)
			protected.PATCH("/issues/:id", middleware.RequireWrite(), issueH.Update)
			protected.PATCH("/issues/:id/move", middleware.RequireWrite(), issueH.Move)
			protected.DELETE("/issues/:id", middleware.RequireWrite(), issueH.Delete)

			// Subtasks
			protected.POST("/issues/:id/subtasks", middleware.RequireWrite(), subtaskH.Create)
			protected.PATCH("/subtasks/:id", middleware.RequireWrite(), subtaskH.Update)
			protected.DELETE("/subtasks/:id", middleware.RequireWrite(), subtaskH.Delete)

			// Comments
			protected.POST("/issues/:id/comments", middleware.RequireWrite(), commentH.Create)
			protected.DELETE("/comments/:id", commentH.Delete)

			// Cross-project Analytics Dashboard
			protected.GET("/analytics/dashboard", analyticsH.GetDashboard)
		}
	}

	// Embedded Static Frontend (Single Binary SPA Server)
	distSubFS, err := fs.Sub(staticFS, "dist")
	if err == nil {
		fileServer := http.FileServer(http.FS(distSubFS))

		r.NoRoute(func(c *gin.Context) {
			path := c.Request.URL.Path
			// If it's an API route that didn't match, return 404 JSON
			if strings.HasPrefix(path, "/api/") {
				c.JSON(http.StatusNotFound, gin.H{"error": "API route not found"})
				return
			}

			// Check if file physically exists in dist
			cleanPath := strings.TrimPrefix(path, "/")
			if cleanPath != "" {
				if f, openErr := distSubFS.Open(cleanPath); openErr == nil {
					_ = f.Close()
					fileServer.ServeHTTP(c.Writer, c.Request)
					return
				}
			}

			// SPA Fallback: serve index.html for React Router
			indexData, err := fs.ReadFile(distSubFS, "index.html")
			if err != nil {
				c.String(http.StatusOK, "My Perfect PM Backend Running")
				return
			}
			c.Data(http.StatusOK, "text/html; charset=utf-8", indexData)
		})
	}

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("==================================================")
		log.Printf("🚀 My Perfect PM is running on port %s", cfg.Port)
		log.Printf("Default Admin: %s / %s", cfg.AdminEmail, cfg.AdminPassword)
		log.Printf("Environment: %s | DB: %s", cfg.Environment, cfg.DBPath)
		log.Printf("==================================================")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server listen failed: %v", err)
		}
	}()

	// Graceful shutdown on SIGINT / SIGTERM
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down My Perfect PM server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	log.Println("Server exiting gracefully.")
}

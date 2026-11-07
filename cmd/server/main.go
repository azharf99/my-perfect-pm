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
)

//go:embed dist/*
var staticFS embed.FS

func main() {
	cfg := config.Load()

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 1. Initialize SQLite Database
	db, err := database.InitDB(cfg.DBPath)
	if err != nil {
		log.Fatalf("Database initialization failed: %v", err)
	}

	// 2. Auto-seed demo workspace & admin account if empty
	if err := database.SeedInitialData(db); err != nil {
		log.Printf("Warning: Seeding failed: %v", err)
	}

	// 3. Router setup
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
			auth.POST("/register", authH.Register)
			auth.POST("/refresh", authH.Refresh)
			auth.POST("/logout", authH.Logout)
			auth.GET("/csrf", authH.GetCSRF)
		}

		// Protected Routes
		protected := api.Group("")
		protected.Use(middleware.Auth(cfg.JWTSecret))
		{
			// Current user info
			protected.GET("/auth/me", authH.Me)

			// Projects
			protected.GET("/projects", projH.List)
			protected.POST("/projects", projH.Create)
			protected.GET("/projects/:id", projH.Get)
			protected.PUT("/projects/:id", projH.Update)
			protected.DELETE("/projects/:id", projH.Delete)
			protected.GET("/projects/members", projH.ListMembers)

			// Sprints
			protected.GET("/projects/:id/sprints", sprintH.ListByProject)
			protected.POST("/projects/:id/sprints", sprintH.Create)
			protected.POST("/sprints/:id/start", sprintH.Start)
			protected.POST("/sprints/:id/complete", sprintH.Complete)

			// Issues
			protected.GET("/issues", issueH.List)
			protected.POST("/issues", issueH.Create)
			protected.GET("/issues/:id", issueH.Get)
			protected.PATCH("/issues/:id", issueH.Update)
			protected.PATCH("/issues/:id/move", issueH.Move)
			protected.DELETE("/issues/:id", issueH.Delete)

			// Subtasks
			protected.POST("/issues/:id/subtasks", subtaskH.Create)
			protected.PATCH("/subtasks/:id", subtaskH.Update)
			protected.DELETE("/subtasks/:id", subtaskH.Delete)

			// Comments
			protected.POST("/issues/:id/comments", commentH.Create)
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
		log.Printf("Default Admin: %s / %s!", cfg.AdminEmail, cfg.AdminPassword)
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

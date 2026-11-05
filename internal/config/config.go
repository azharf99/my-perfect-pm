package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port               string
	DBPath             string
	JWTSecret          string
	Environment        string
	CORSAllowedOrigins string
	RateLimitRequests  int
}

func Load() *Config {
	port := getEnv("PORT", "8080")
	dbPath := getEnv("DB_PATH", "pm.db")
	jwtSecret := getEnv("JWT_SECRET", "super-secret-production-key-change-me-1234567890")
	env := getEnv("ENV", "development")
	corsAllowed := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:8080")

	rateLimitStr := getEnv("RATE_LIMIT_RPS", "120")
	rateLimit, err := strconv.Atoi(rateLimitStr)
	if err != nil {
		rateLimit = 120
	}

	return &Config{
		Port:               port,
		DBPath:             dbPath,
		JWTSecret:          jwtSecret,
		Environment:        env,
		CORSAllowedOrigins: corsAllowed,
		RateLimitRequests:  rateLimit,
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

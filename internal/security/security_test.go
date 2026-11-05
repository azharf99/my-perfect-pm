package security

import (
	"testing"
	"time"
)

func TestPasswordHashing(t *testing.T) {
	password := "SecretPassword123!"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if !CheckPasswordHash(password, hash) {
		t.Fatalf("Password verification failed for correct password")
	}

	if CheckPasswordHash("WrongPassword!", hash) {
		t.Fatalf("Password verification succeeded for wrong password")
	}
}

func TestJWTTokenGenerationAndValidation(t *testing.T) {
	secret := "test-secret-key-12345"
	userID := "user-123"
	email := "test@example.com"
	tenantID := "tenant-456"
	role := "admin"

	token, err := GenerateAccessToken(userID, email, tenantID, role, secret, 1*time.Hour)
	if err != nil {
		t.Fatalf("Failed to generate access token: %v", err)
	}

	claims, err := ValidateAccessToken(token, secret)
	if err != nil {
		t.Fatalf("Failed to validate access token: %v", err)
	}

	if claims.UserID != userID || claims.Email != email || claims.TenantID != tenantID || claims.Role != role {
		t.Fatalf("Claims mismatch: got %+v", claims)
	}

	// Test with wrong secret
	_, err = ValidateAccessToken(token, "wrong-secret-key")
	if err == nil {
		t.Fatalf("Expected validation to fail with wrong secret, but succeeded")
	}
}

func TestCSRFTokenGenerationAndValidation(t *testing.T) {
	token, err := GenerateCSRFToken()
	if err != nil {
		t.Fatalf("Failed to generate CSRF token: %v", err)
	}

	if len(token) != 64 {
		t.Fatalf("Expected token length 64 hex characters, got %d", len(token))
	}

	// Valid match
	if err := ValidateCSRF(token, token); err != nil {
		t.Fatalf("Expected CSRF tokens to match, got %v", err)
	}

	// Mismatched
	if err := ValidateCSRF(token, "different-token"); err == nil {
		t.Fatalf("Expected mismatched tokens to fail validation")
	}

	// Empty
	if err := ValidateCSRF("", token); err == nil {
		t.Fatalf("Expected empty cookie token to fail validation")
	}
}

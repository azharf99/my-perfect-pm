package security

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	purposeAccess     = "access"
	purposeMFAPending = "mfa_pending"
)

type JWTClaims struct {
	UserID       string `json:"user_id"`
	Email        string `json:"email"`
	TenantID     string `json:"tenant_id"`
	Role         string `json:"role"`
	TokenVersion int    `json:"tv"`
	Purpose      string `json:"purpose"`
	jwt.RegisteredClaims
}

func sign(claims JWTClaims, secret string, duration time.Duration) (string, error) {
	now := time.Now()
	claims.RegisteredClaims = jwt.RegisteredClaims{
		ID:        uuid.NewString(),
		Subject:   claims.UserID,
		ExpiresAt: jwt.NewNumericDate(now.Add(duration)),
		IssuedAt:  jwt.NewNumericDate(now),
		NotBefore: jwt.NewNumericDate(now),
		Issuer:    "my-perfect-pm",
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

func GenerateAccessToken(userID, email, tenantID, role string, tokenVersion int, secret string, duration time.Duration) (string, error) {
	if duration <= 0 {
		duration = 60 * time.Minute
	}
	return sign(JWTClaims{
		UserID: userID, Email: email, TenantID: tenantID, Role: role,
		TokenVersion: tokenVersion, Purpose: purposeAccess,
	}, secret, duration)
}

// GenerateMFAPendingToken issues a 5-minute token proving the password step succeeded.
func GenerateMFAPendingToken(userID string, tokenVersion int, secret string) (string, error) {
	return sign(JWTClaims{UserID: userID, TokenVersion: tokenVersion, Purpose: purposeMFAPending}, secret, 5*time.Minute)
}

func parse(tokenString, secret string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	}, jwt.WithIssuer("my-perfect-pm"))
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}
	return claims, nil
}

func ValidateAccessToken(tokenString, secret string) (*JWTClaims, error) {
	c, err := parse(tokenString, secret)
	if err != nil {
		return nil, err
	}
	if c.Purpose != purposeAccess {
		return nil, errors.New("wrong token purpose")
	}
	return c, nil
}

func ValidateMFAPendingToken(tokenString, secret string) (*JWTClaims, error) {
	c, err := parse(tokenString, secret)
	if err != nil {
		return nil, err
	}
	if c.Purpose != purposeMFAPending {
		return nil, errors.New("wrong token purpose")
	}
	return c, nil
}

func GenerateRefreshTokenString() string {
	return uuid.NewString() + "-" + uuid.NewString()
}

func HashToken(rawToken string) string {
	hash := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(hash[:])
}

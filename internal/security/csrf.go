package security

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
)

func GenerateCSRFToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func ValidateCSRF(cookieToken, headerToken string) error {
	if cookieToken == "" || headerToken == "" {
		return errors.New("missing csrf token in cookie or header")
	}
	if subtle.ConstantTimeCompare([]byte(cookieToken), []byte(headerToken)) != 1 {
		return errors.New("invalid csrf token")
	}
	return nil
}

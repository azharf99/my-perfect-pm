package security

import (
	"errors"
	"strings"
	"unicode"

	"golang.org/x/crypto/bcrypt"
)

// ValidatePasswordPolicy enforces min 8 chars with upper, lower and digit,
// and rejects passwords containing the email local-part.
func ValidatePasswordPolicy(password, email string) error {
	if len(password) < 8 {
		return errors.New("password must be at least 8 characters")
	}
	if len(password) > 128 {
		return errors.New("password must be at most 128 characters")
	}
	var hasUpper, hasLower, hasDigit bool
	for _, r := range password {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasDigit = true
		}
	}
	if !hasUpper || !hasLower || !hasDigit {
		return errors.New("password must contain uppercase, lowercase and a digit")
	}
	if email != "" {
		local := strings.ToLower(strings.SplitN(email, "@", 2)[0])
		if len(local) >= 3 && strings.Contains(strings.ToLower(password), local) {
			return errors.New("password must not contain your email name")
		}
	}
	return nil
}

func HashPassword(password string) (string, error) {
	if len(password) < 6 {
		return "", errors.New("password must be at least 6 characters")
	}
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// dummyHash is used to equalize timing when the user doesn't exist.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("timing-equalizer-password"), bcrypt.DefaultCost)

func DummyPasswordCheck(password string) {
	_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
}

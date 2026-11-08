package security

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	qrcode "github.com/skip2/go-qrcode"
)

const totpPeriod = 30

// GenerateTOTP returns a new secret and a PNG data URI of the provisioning QR code.
func GenerateTOTP(accountEmail string) (secret string, qrDataURI string, otpauthURL string, err error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "My Perfect PM",
		AccountName: accountEmail,
		Period:      totpPeriod,
		Digits:      otp.DigitsSix,
		Algorithm:   otp.AlgorithmSHA1,
	})
	if err != nil {
		return "", "", "", err
	}
	png, err := qrcode.Encode(key.URL(), qrcode.Medium, 240)
	if err != nil {
		return "", "", "", err
	}
	return key.Secret(), "data:image/png;base64," + base64.StdEncoding.EncodeToString(png), key.URL(), nil
}

// ValidateTOTP checks a code with ±1 step skew and returns the matched time step.
// Codes whose step is <= lastStep are rejected (replay protection).
func ValidateTOTP(secret, code string, lastStep int64) (int64, bool) {
	code = strings.TrimSpace(strings.ReplaceAll(code, " ", ""))
	if len(code) != 6 {
		return 0, false
	}
	now := time.Now().Unix() / totpPeriod
	for _, step := range []int64{now - 1, now, now + 1} {
		if step <= lastStep {
			continue
		}
		expected, err := totp.GenerateCodeCustom(secret, time.Unix(step*totpPeriod, 0), totp.ValidateOpts{
			Period: totpPeriod, Digits: otp.DigitsSix, Algorithm: otp.AlgorithmSHA1,
		})
		if err == nil && subtleEq(expected, code) {
			return step, true
		}
	}
	return 0, false
}

func subtleEq(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	var v byte
	for i := 0; i < len(a); i++ {
		v |= a[i] ^ b[i]
	}
	return v == 0
}

const recoveryAlphabet = "abcdefghjkmnpqrstuvwxyz23456789"

// GenerateRecoveryCodes returns n codes in format xxxx-xxxx-xx.
func GenerateRecoveryCodes(n int) ([]string, error) {
	codes := make([]string, n)
	for i := range codes {
		b := make([]byte, 10)
		for j := range b {
			idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(recoveryAlphabet))))
			if err != nil {
				return nil, err
			}
			b[j] = recoveryAlphabet[idx.Int64()]
		}
		s := string(b)
		codes[i] = fmt.Sprintf("%s-%s-%s", s[:4], s[4:8], s[8:])
	}
	return codes, nil
}

func NormalizeRecoveryCode(c string) string {
	return strings.ToLower(strings.TrimSpace(c))
}

// GenerateTempPassword creates a policy-compliant random password.
func GenerateTempPassword() (string, error) {
	const (
		upper  = "ABCDEFGHJKLMNPQRSTUVWXYZ"
		lower  = "abcdefghijkmnpqrstuvwxyz"
		digits = "23456789"
		all    = upper + lower + digits
	)
	pick := func(set string) (byte, error) {
		idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(set))))
		if err != nil {
			return 0, err
		}
		return set[idx.Int64()], nil
	}
	out := make([]byte, 0, 14)
	for _, set := range []string{upper, lower, digits} {
		c, err := pick(set)
		if err != nil {
			return "", err
		}
		out = append(out, c)
	}
	for len(out) < 14 {
		c, err := pick(all)
		if err != nil {
			return "", err
		}
		out = append(out, c)
	}
	// shuffle
	for i := len(out) - 1; i > 0; i-- {
		j, _ := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		out[i], out[j.Int64()] = out[j.Int64()], out[i]
	}
	return string(out), nil
}

package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"

	"golang.org/x/crypto/hkdf"
)

var encKey []byte

// InitEncryption sets the AES-256 key. rawKeyB64 must decode to 32 bytes;
// if empty, a key is derived from fallbackSecret via HKDF (dev only).
func InitEncryption(rawKeyB64, fallbackSecret string) error {
	if rawKeyB64 != "" {
		k, err := base64.StdEncoding.DecodeString(rawKeyB64)
		if err != nil || len(k) != 32 {
			return errors.New("ENCRYPTION_KEY must be base64 of exactly 32 bytes (openssl rand -base64 32)")
		}
		encKey = k
		return nil
	}
	if fallbackSecret == "" {
		return errors.New("no encryption key material available")
	}
	r := hkdf.New(sha256.New, []byte(fallbackSecret), []byte("my-perfect-pm"), []byte("totp-secret-encryption"))
	k := make([]byte, 32)
	if _, err := io.ReadFull(r, k); err != nil {
		return err
	}
	encKey = k
	return nil
}

func Encrypt(plain string) (string, error) {
	if encKey == nil {
		return "", errors.New("encryption not initialized")
	}
	block, err := aes.NewCipher(encKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	out := gcm.Seal(nonce, nonce, []byte(plain), nil)
	return base64.StdEncoding.EncodeToString(out), nil
}

func Decrypt(enc string) (string, error) {
	if encKey == nil {
		return "", errors.New("encryption not initialized")
	}
	data, err := base64.StdEncoding.DecodeString(enc)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(encKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(data) < gcm.NonceSize() {
		return "", errors.New("ciphertext too short")
	}
	nonce, ct := data[:gcm.NonceSize()], data[gcm.NonceSize():]
	pt, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", err
	}
	return string(pt), nil
}

package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type ipBucket struct {
	tokens     float64
	lastRefill time.Time
}

type RateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*ipBucket
	rate    float64 // tokens added per second
	burst   float64 // maximum tokens in bucket
}

func NewRateLimiter(rps float64, burst float64) *RateLimiter {
	rl := &RateLimiter{
		buckets: make(map[string]*ipBucket),
		rate:    rps,
		burst:   burst,
	}

	// Background cleanup of stale buckets every 5 minutes
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		for range ticker.C {
			rl.mu.Lock()
			threshold := time.Now().Add(-10 * time.Minute)
			for ip, b := range rl.buckets {
				if b.lastRefill.Before(threshold) {
					delete(rl.buckets, ip)
				}
			}
			rl.mu.Unlock()
		}
	}()

	return rl
}

func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if ip == "" {
			ip = "unknown"
		}

		rl.mu.Lock()
		b, exists := rl.buckets[ip]
		now := time.Now()
		if !exists {
			b = &ipBucket{
				tokens:     rl.burst,
				lastRefill: now,
			}
			rl.buckets[ip] = b
		} else {
			// Refill tokens based on elapsed time
			elapsed := now.Sub(b.lastRefill).Seconds()
			b.tokens = b.tokens + elapsed*rl.rate
			if b.tokens > rl.burst {
				b.tokens = rl.burst
			}
			b.lastRefill = now
		}

		if b.tokens < 1.0 {
			rl.mu.Unlock()
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "Too many requests. Please slow down.",
			})
			return
		}

		b.tokens -= 1.0
		rl.mu.Unlock()

		c.Next()
	}
}

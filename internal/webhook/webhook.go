package webhook

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"seller/internal/httpx"
)

// EventPayload defines the standard webhook JSON envelope contract.
type EventPayload struct {
	ID         string          `json:"id"`
	EventType  string          `json:"event_type"`
	APIVersion string          `json:"api_version"`
	CreatedAt  time.Time       `json:"created_at"`
	ActorType  string          `json:"actor_type"`
	ActorID    string          `json:"actor_id"`
	Data       json.RawMessage `json:"data"`
}

// Client delivers webhook payloads over HTTP/HTTPS with HMAC signatures and retry logic.
type Client struct {
	httpClient *http.Client
	maxRetries int
	timeout    time.Duration
}

// NewClient constructs a Webhook Client.
func NewClient(timeout time.Duration, maxRetries int) *Client {
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	if maxRetries < 0 {
		maxRetries = 3
	}
	return &Client{
		httpClient: &http.Client{Timeout: timeout},
		maxRetries: maxRetries,
		timeout:    timeout,
	}
}

// ValidateTargetURL ensures a target webhook URL uses valid http or https scheme.
func ValidateTargetURL(targetURL string) error {
	u, err := url.ParseRequestURI(targetURL)
	if err != nil {
		return fmt.Errorf("invalid webhook URL: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return errors.New("webhook URL scheme must be http or https")
	}
	if u.Host == "" {
		return errors.New("webhook URL must have a valid host")
	}
	return nil
}

// ComputeSignature calculates the HMAC-SHA256 signature header for a payload.
// Format: t=<timestamp>,v1=<hex_hmac>
func ComputeSignature(payload []byte, secret string, timestamp int64) string {
	mac := hmac.New(sha256.New, []byte(secret))
	signatureInput := fmt.Sprintf("%d.%s", timestamp, string(payload))
	mac.Write([]byte(signatureInput))
	expectedMAC := hex.EncodeToString(mac.Sum(nil))
	return fmt.Sprintf("t=%d,v1=%s", timestamp, expectedMAC)
}

// Deliver sends an EventPayload to targetURL signed with secret.
func (c *Client) Deliver(ctx context.Context, targetURL, secret string, payload EventPayload) (int, error) {
	if err := ValidateTargetURL(targetURL); err != nil {
		return 0, err
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return 0, fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	now := time.Now().Unix()
	signature := ComputeSignature(bodyBytes, secret, now)

	var lastErr error
	var statusCode int

	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(1<<attempt) * 100 * time.Millisecond
			select {
			case <-ctx.Done():
				return 0, ctx.Err()
			case <-time.After(backoff):
			}
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewReader(bodyBytes))
		if err != nil {
			return 0, fmt.Errorf("failed to create webhook HTTP request: %w", err)
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "Matjero-Webhook/1.0")
		req.Header.Set("X-Matjero-Signature", signature)
		req.Header.Set("X-Matjero-Event", payload.EventType)
		if corrID := httpx.CorrelationID(ctx); corrID != "" {
			req.Header.Set("X-Correlation-Id", corrID)
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		statusCode = resp.StatusCode
		_ = resp.Body.Close()

		if statusCode >= 200 && statusCode < 300 {
			return statusCode, nil
		}
		lastErr = fmt.Errorf("webhook endpoint returned status %d", statusCode)
	}

	return statusCode, lastErr
}

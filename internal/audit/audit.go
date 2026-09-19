package audit

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"seller/internal/httpx"
)

type Event struct {
	Timestamp     time.Time `json:"timestamp"`
	CorrelationID string    `json:"correlation_id"`
	ActorType     string    `json:"actor_type"`
	ActorID       string    `json:"actor_id"`
	Action        string    `json:"action"`
	Resource      string    `json:"resource"`
	Method        string    `json:"method"`
	StatusCode    int       `json:"status_code"`
	DurationMs    int64     `json:"duration_ms"`
	RemoteIP      string    `json:"remote_ip"`
}

type Logger struct {
	logger *slog.Logger
}

func NewLogger(logger *slog.Logger) *Logger {
	if logger == nil {
		logger = slog.Default()
	}
	return &Logger{logger: logger}
}

func (l *Logger) Log(ctx context.Context, actorType, actorID, action, resource string, method string, statusCode int, start time.Time, r *http.Request) {
	duration := time.Since(start).Milliseconds()
	correlationID := httpx.CorrelationID(ctx)
	if correlationID == "" && r != nil {
		correlationID = r.Header.Get("X-Correlation-Id")
	}

	remoteIP := ""
	if r != nil {
		remoteIP = r.RemoteAddr
	}

	l.logger.Info("audit_event",
		slog.Bool("audit", true),
		slog.String("correlation_id", correlationID),
		slog.String("actor_type", actorType),
		slog.String("actor_id", actorID),
		slog.String("action", action),
		slog.String("resource", resource),
		slog.String("method", method),
		slog.Int("status_code", statusCode),
		slog.Int64("duration_ms", duration),
		slog.String("remote_ip", remoteIP),
	)
}

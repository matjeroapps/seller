// Package redisx is the Seller repository's own Redis client.
//
// It is deliberately tiny: the storefront payload cache needs a bounded
// key/value store and nothing else. Every operation is bounded by its own
// timeout and every failure is reported as an ordinary error, because the cache
// is an optimization: a slow or unreachable Redis must degrade to a normal Core
// call rather than delay or fail a customer response.
package redisx

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// Timeout defaults. They are short on purpose: a customer request may not wait
// on the cache longer than the Core call the cache exists to avoid.
const (
	defaultConnectTimeout   = 500 * time.Millisecond
	defaultOperationTimeout = 150 * time.Millisecond
)

// Config configures the client.
type Config struct {
	// Addr is the Redis host:port.
	Addr string
	// Password authenticates against a protected Redis. It is a secret and is
	// never logged.
	Password string
	// DB selects the logical Redis database.
	DB int
	// ConnectTimeout bounds establishing a connection.
	ConnectTimeout time.Duration
	// OperationTimeout bounds a single command.
	OperationTimeout time.Duration
}

// Client is a bounded Redis key/value client.
type Client struct {
	rdb              *redis.Client
	operationTimeout time.Duration
}

// New builds a client.
//
// It validates the address but does not connect: connections are established
// lazily on first use, so an unreachable Redis never prevents a service from
// starting. A malformed address is a configuration error and does fail here,
// because it can never resolve at runtime either.
func New(cfg Config) (*Client, error) {
	addr := strings.TrimSpace(cfg.Addr)
	if addr == "" {
		return nil, errors.New("redisx: address is required")
	}
	if _, _, err := net.SplitHostPort(addr); err != nil {
		return nil, fmt.Errorf("redisx: address must be host:port: %w", err)
	}
	if cfg.DB < 0 {
		return nil, fmt.Errorf("redisx: database index must not be negative, got %d", cfg.DB)
	}

	connectTimeout := cfg.ConnectTimeout
	if connectTimeout <= 0 {
		connectTimeout = defaultConnectTimeout
	}
	operationTimeout := cfg.OperationTimeout
	if operationTimeout <= 0 {
		operationTimeout = defaultOperationTimeout
	}

	return &Client{
		rdb: redis.NewClient(&redis.Options{
			Addr:         addr,
			Password:     cfg.Password,
			DB:           cfg.DB,
			DialTimeout:  connectTimeout,
			ReadTimeout:  operationTimeout,
			WriteTimeout: operationTimeout,
			PoolTimeout:  operationTimeout,
			// A cache read is not worth retrying: a retry multiplies the latency
			// budget of a request that can already fall back to Core.
			MaxRetries: -1,
		}),
		operationTimeout: operationTimeout,
	}, nil
}

// Get reads a value. A missing key is reported as found=false with no error, so
// a caller never has to compare against a driver sentinel.
func (c *Client) Get(ctx context.Context, key string) ([]byte, bool, error) {
	ctx, cancel := context.WithTimeout(ctx, c.operationTimeout)
	defer cancel()

	value, err := c.rdb.Get(ctx, key).Bytes()
	switch {
	case errors.Is(err, redis.Nil):
		return nil, false, nil
	case err != nil:
		return nil, false, fmt.Errorf("redisx: get: %w", err)
	}
	return value, true, nil
}

// Set writes a value with an expiry. A zero or negative ttl is rejected rather
// than stored forever: an entry that never expires can outlive the state it was
// derived from.
func (c *Client) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	if ttl <= 0 {
		return errors.New("redisx: ttl must be greater than zero")
	}

	ctx, cancel := context.WithTimeout(ctx, c.operationTimeout)
	defer cancel()

	if err := c.rdb.Set(ctx, key, value, ttl).Err(); err != nil {
		return fmt.Errorf("redisx: set: %w", err)
	}
	return nil
}

// Close releases the connection pool.
func (c *Client) Close() error {
	return c.rdb.Close()
}

package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	ServiceName        string
	Environment        string
	HTTPAddr           string
	RedisAddr          string
	RabbitMQURL        string
	ZitadelIssuer      string
	ZitadelAudience    string
	OpenAPIDocsEnabled bool
	ShutdownTimeout    time.Duration

	// RedisPassword authenticates against a protected Redis. It is a secret:
	// never commit it, log it, or bake it into an image layer.
	RedisPassword string
	// RedisDB selects the logical Redis database.
	RedisDB int
	// RedisConnectTimeout bounds establishing a Redis connection.
	RedisConnectTimeout time.Duration
	// RedisOperationTimeout bounds a single Redis command. It is deliberately
	// short: the cache is an optimization, and a slow Redis must degrade to a
	// normal Core call instead of delaying a customer response.
	RedisOperationTimeout time.Duration

	// StorefrontCacheEnabled turns on the public storefront payload cache. It is
	// off by default, so storefront-api never requires Redis to start.
	StorefrontCacheEnabled bool
	// StorefrontCacheTTL bounds how long a cached payload may live. It is only a
	// safety net: correctness comes from the Core revision in the cache key, and
	// the TTL is what lets entries of an abandoned revision expire without any
	// wildcard deletion.
	StorefrontCacheTTL time.Duration
	// StorefrontCacheMaxPayloadBytes bounds the size of a single cached payload.
	// A larger successful response is served normally and simply not cached, so
	// one unusually large store cannot dominate the cache.
	StorefrontCacheMaxPayloadBytes int

	// PlatformDomain is the base domain under which platform-generated store
	// subdomains are allocated (e.g. "<store-code>.matjero.com"). It is
	// configuration-driven and never hardcoded in application code.
	PlatformDomain string
	// TrustedForwardedHost enables honoring the X-Forwarded-Host header for
	// tenant resolution. It must only be enabled behind an explicitly trusted
	// reverse proxy; otherwise the request Host header is authoritative.
	TrustedForwardedHost bool
	// ReservedSubdomains are subdomain labels that sellers may not claim as a
	// store code (e.g. www, api, admin).
	ReservedSubdomains []string

	// CoreAPIBaseURL is the root of the Core internal API, e.g.
	// "http://core-api:8080". Every Core-owned business capability is reached
	// through it (ADR-017).
	CoreAPIBaseURL string
	// CoreAPIToken is this service's credential for the Core internal API. It is
	// a secret: never commit it, log it, or bake it into an image layer.
	CoreAPIToken string
	// CoreAPITimeout bounds a single Core call.
	CoreAPITimeout time.Duration
}

func Load(serviceName string) (Config, error) {
	if serviceName == "" {
		return Config{}, fmt.Errorf("service name is required")
	}

	timeoutSeconds, err := intEnv("SHUTDOWN_TIMEOUT_SECONDS", 10)
	if err != nil {
		return Config{}, err
	}

	coreTimeoutSeconds, err := intEnv("CORE_API_TIMEOUT_SECONDS", 10)
	if err != nil {
		return Config{}, err
	}

	redisDB, err := nonNegativeIntEnv("REDIS_DB", 0)
	if err != nil {
		return Config{}, err
	}
	redisConnectMS, err := intEnv("REDIS_CONNECT_TIMEOUT_MS", 500)
	if err != nil {
		return Config{}, err
	}
	redisOperationMS, err := intEnv("REDIS_OPERATION_TIMEOUT_MS", 150)
	if err != nil {
		return Config{}, err
	}
	cacheTTLSeconds, err := intEnv("STOREFRONT_CACHE_TTL_SECONDS", 300)
	if err != nil {
		return Config{}, err
	}
	cacheMaxPayloadBytes, err := intEnv("STOREFRONT_CACHE_MAX_PAYLOAD_BYTES", 256<<10)
	if err != nil {
		return Config{}, err
	}

	return Config{
		ServiceName:          serviceName,
		Environment:          stringEnv("APP_ENV", "development"),
		HTTPAddr:             stringEnv("HTTP_ADDR", ":8080"),
		RedisAddr:            stringEnv("REDIS_ADDR", "localhost:6379"),
		RabbitMQURL:          stringEnv("RABBITMQ_URL", "amqp://commerce:commerce@localhost:5672/"),
		ZitadelIssuer:        stringEnv("ZITADEL_ISSUER", "http://localhost:8081"),
		ZitadelAudience:      stringEnv("ZITADEL_AUDIENCE", serviceName),
		OpenAPIDocsEnabled:   boolEnv("OPENAPI_DOCS_ENABLED", stringEnv("APP_ENV", "development") != "production"),
		ShutdownTimeout:      time.Duration(timeoutSeconds) * time.Second,
		PlatformDomain:       stringEnv("PLATFORM_DOMAIN", "matjero.com"),
		TrustedForwardedHost: boolEnv("TRUSTED_FORWARDED_HOST", false),
		ReservedSubdomains:   stringSliceEnv("RESERVED_SUBDOMAINS", []string{"www", "api", "admin", "app", "cdn", "mail", "seller", "supplier", "static", "assets"}),

		CoreAPIBaseURL: stringEnv("CORE_API_BASE_URL", "http://localhost:8080"),
		CoreAPIToken:   stringEnv("CORE_API_TOKEN", ""),
		CoreAPITimeout: time.Duration(coreTimeoutSeconds) * time.Second,

		RedisPassword:         stringEnv("REDIS_PASSWORD", ""),
		RedisDB:               redisDB,
		RedisConnectTimeout:   time.Duration(redisConnectMS) * time.Millisecond,
		RedisOperationTimeout: time.Duration(redisOperationMS) * time.Millisecond,

		StorefrontCacheEnabled:         boolEnv("STOREFRONT_CACHE_ENABLED", false),
		StorefrontCacheTTL:             time.Duration(cacheTTLSeconds) * time.Second,
		StorefrontCacheMaxPayloadBytes: cacheMaxPayloadBytes,
	}, nil
}

// stringSliceEnv reads a comma-separated environment variable, trimming
// whitespace from each entry and dropping empty values.
func stringSliceEnv(key string, fallback []string) []string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	if len(out) == 0 {
		return fallback
	}
	return out
}

func stringEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func intEnv(key string, fallback int) (int, error) {
	value := os.Getenv(key)
	if value == "" {
		return fallback, nil
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer: %w", key, err)
	}
	if parsed <= 0 {
		return 0, fmt.Errorf("%s must be greater than zero", key)
	}

	return parsed, nil
}

// nonNegativeIntEnv reads an integer that may legitimately be zero, such as a
// Redis database index.
func nonNegativeIntEnv(key string, fallback int) (int, error) {
	value := os.Getenv(key)
	if value == "" {
		return fallback, nil
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer: %w", key, err)
	}
	if parsed < 0 {
		return 0, fmt.Errorf("%s must not be negative", key)
	}

	return parsed, nil
}

func boolEnv(key string, fallback bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

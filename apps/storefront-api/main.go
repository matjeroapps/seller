// Command storefront-api serves the public, anonymous storefront HTTP surface.
//
// Tenant identity comes from the trusted request host and is forwarded to Core,
// which resolves the store and applies the catalog scope. The catalog read model
// is a Core-owned business capability reached over the internal API (ADR-017);
// this service holds no database connection and imports no Core Go package.
//
// Public payloads may additionally be cached in a Seller-owned Redis. The cache
// is optional and off by default: it is never required to start, and a Redis
// outage degrades to ordinary Core reads.
package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/seller/internal/actorapi"
	"github.com/matjeroapps/seller/internal/config"
	"github.com/matjeroapps/seller/internal/coreclient"
	"github.com/matjeroapps/seller/internal/httpx"
	"github.com/matjeroapps/seller/internal/logging"
	"github.com/matjeroapps/seller/internal/observability"
	"github.com/matjeroapps/seller/internal/openapi"
	"github.com/matjeroapps/seller/internal/redisx"
	"github.com/matjeroapps/seller/internal/storefrontapi"
	"github.com/matjeroapps/seller/internal/storefrontcache"
)

func main() {
	if err := run(context.Background()); err != nil {
		log.Fatal(err)
	}
}

func run(ctx context.Context) error {
	cfg, err := config.Load("storefront-api")
	if err != nil {
		return err
	}

	logger := logging.New(cfg)
	shutdown, err := observability.Init(ctx, cfg)
	if err != nil {
		return err
	}
	defer func() { _ = shutdown(context.Background()) }()

	core, err := coreclient.New(coreclient.Config{
		BaseURL: cfg.CoreAPIBaseURL,
		Token:   cfg.CoreAPIToken,
		Service: "seller",
		Timeout: cfg.CoreAPITimeout,
	})
	if err != nil {
		return err
	}

	cache, closeCache, err := buildCache(cfg, logger)
	if err != nil {
		return err
	}
	defer func() { _ = closeCache() }()

	appCfg := httpx.ConfigFrom(cfg)
	router := httpx.NewRouter(httpx.App{
		Config: appCfg,
		Logger: logger,
		// No database and no local dependency to probe; Core reachability is
		// surfaced per request as a 503 rather than failing readiness, so a Core
		// blip does not take every storefront replica out of rotation. Redis is
		// deliberately not probed either: the cache is optional, and a cache
		// outage must not remove a replica that can still serve every request.
		Ready: func(context.Context) error { return nil },
	})

	spec, err := openapi.BuildStorefrontSpec()
	if err != nil {
		return err
	}
	specBytes, err := openapi.MarshalDocument(spec)
	if err != nil {
		return err
	}
	openapi.Register(router, openapi.RouterConfig{
		Enabled:   cfg.OpenAPIDocsEnabled,
		SpecPath:  "/openapi.json",
		DocsPath:  "/docs",
		SpecBytes: specBytes,
	})

	// The storefront is anonymous: no OIDC verifier is mounted. Tenant authority
	// is the trusted host, never a client-supplied identifier.
	router.Mount("/", actorapi.NewRouter(actorapi.Config{
		AppName:     "Storefront API",
		Actor:       "storefront",
		RequireAuth: false,
		Register: func(r chi.Router) {
			storefrontapi.RegisterStorefrontRoutes(storefrontapi.Dependencies{
				Catalog:   core,
				Platform:  cfg,
				Cache:     cache,
				Revisions: core,
			})(r)
		},
	}, core, nil))

	return httpx.Run(ctx, appCfg, logger, router)
}

// buildCache builds the storefront payload cache. If caching is disabled in the
// config, it returns a no-op cache and a no-op closer. If caching is enabled but
// Redis is unavailable, it returns an error: a misconfigured deployment should
// fail at startup rather than silently disabling the feature.
func buildCache(cfg config.Config, logger *slog.Logger) (storefrontapi.PayloadCache, func() error, error) {
	if !cfg.StorefrontCacheEnabled {
		// Return a nil cache, which causes cachingActive to return false in the
		// storefront handlers.
		return nil, func() error { return nil }, nil
	}

	// Redis is required when caching is enabled.
	redisClient, err := redisx.New(redisx.Config{
		Addr:             cfg.RedisAddr,
		Password:         cfg.RedisPassword,
		DB:               cfg.RedisDB,
		ConnectTimeout:   cfg.RedisConnectTimeout,
		OperationTimeout: cfg.RedisOperationTimeout,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("build storefront cache: %w", err)
	}

	cache, err := storefrontcache.New(redisClient, storefrontcache.Config{
		TTL:             cfg.StorefrontCacheTTL,
		MaxPayloadBytes: cfg.StorefrontCacheMaxPayloadBytes,
		Logger:          logger,
	})
	if err != nil {
		_ = redisClient.Close()
		return nil, nil, fmt.Errorf("build storefront cache: %w", err)
	}

	return cache, redisClient.Close, nil
}

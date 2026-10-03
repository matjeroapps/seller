// Command seller-api serves the authenticated Seller Platform HTTP surface.
//
// It owns request parsing, end-user authentication, and the public response
// contract. Every business capability is a Core-owned runtime call over the
// internal API (ADR-017); this service holds no database connection and imports
// no Core Go package.
package main

import (
	"context"
	"log"
	"time"

	"github.com/go-chi/chi/v5"

	"seller/internal/actorapi"
	"seller/internal/audit"
	"seller/internal/auth"
	"seller/internal/config"
	"seller/internal/coreclient"
	"seller/internal/httpx"
	"seller/internal/idempotency"
	"seller/internal/logging"
	"seller/internal/observability"
	"seller/internal/openapi"
	"seller/internal/ratelimit"
	"seller/internal/redisx"
	"seller/internal/sellerapi"
)

func main() {
	if err := run(context.Background()); err != nil {
		log.Fatal(err)
	}
}

func run(ctx context.Context) error {
	cfg, err := config.Load("seller-api")
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

	verifier, err := auth.NewOIDCVerifier(ctx, auth.Config{
		IssuerURL:    cfg.ZitadelIssuer,
		DiscoveryURL: cfg.ZitadelDiscoveryURL,
		Audience:     cfg.ZitadelAudience,
		RolesClaim:   auth.DefaultRolesClaim(),
	})
	if err != nil {
		return err
	}

	var redisClient *redisx.Client
	if cfg.RedisAddr != "" {
		if rc, err := redisx.New(redisx.Config{
			Addr:     cfg.RedisAddr,
			Password: cfg.RedisPassword,
			DB:       cfg.RedisDB,
		}); err == nil {
			redisClient = rc
		}
	}

	limiter := ratelimit.NewLimiter(redisClient, 1000, 1*time.Hour)
	idempotencyStore := idempotency.NewStore(redisClient, 24*time.Hour)
	auditLogger := audit.NewLogger(logger)

	appCfg := httpx.ConfigFrom(cfg)
	router := httpx.NewRouter(httpx.App{
		Config: appCfg,
		Logger: logger,
		// Readiness reflects the dependencies this service actually has. It has
		// no database; Core reachability is a separate concern that a liveness
		// probe must not depend on, or a Core blip would restart every seller
		// replica.
		Ready: func(context.Context) error { return nil },
	})

	spec, err := openapi.BuildSellerSpec()
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

	router.Mount("/", actorapi.NewRouter(actorapi.Config{
		AppName:      "Seller API",
		Actor:        "seller",
		RequireAuth:  true,
		AllowedRoles: []string{auth.RoleSellerOwner, auth.RoleSellerManager, auth.RoleSellerStaff},
		Console:      core,
		Register: func(r chi.Router) {
			sellerapi.RegisterSellerRoutes(sellerapi.Dependencies{
				Core:             core,
				Limiter:          limiter,
				IdempotencyStore: idempotencyStore,
				AuditLogger:      auditLogger,
			})(r)
			sellerapi.RegisterSellerThemeRoutes(sellerapi.ThemeDependencies{Themes: core})(r)
			sellerapi.RegisterSellerDomainRoutes(sellerapi.DomainDependencies{Domains: core})(r)
			sellerapi.RegisterMerchantSupplyRoutes(sellerapi.Dependencies{Core: core})(r)
		},
	}, core, verifier))

	return httpx.Run(ctx, appCfg, logger, router)
}

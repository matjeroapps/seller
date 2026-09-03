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

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/seller/internal/actorapi"
	"github.com/matjeroapps/seller/internal/auth"
	"github.com/matjeroapps/seller/internal/config"
	"github.com/matjeroapps/seller/internal/coreclient"
	"github.com/matjeroapps/seller/internal/httpx"
	"github.com/matjeroapps/seller/internal/logging"
	"github.com/matjeroapps/seller/internal/observability"
	"github.com/matjeroapps/seller/internal/openapi"
	"github.com/matjeroapps/seller/internal/sellerapi"
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
		IssuerURL:  cfg.ZitadelIssuer,
		Audience:   cfg.ZitadelAudience,
		RolesClaim: auth.DefaultRolesClaim(),
	})
	if err != nil {
		return err
	}

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
		Register: func(r chi.Router) {
			sellerapi.RegisterSellerRoutes(sellerapi.Dependencies{Core: core})(r)
			sellerapi.RegisterSellerThemeRoutes(sellerapi.ThemeDependencies{Themes: core})(r)
			sellerapi.RegisterSellerDomainRoutes(sellerapi.DomainDependencies{Domains: core})(r)
		},
	}, core, verifier))

	return httpx.Run(ctx, appCfg, logger, router)
}

// Command storefront-api serves the public, anonymous storefront HTTP surface.
//
// Tenant identity comes from the trusted request host and is forwarded to Core,
// which resolves the store and applies the catalog scope. The catalog read model
// is a Core-owned business capability reached over the internal API (ADR-017);
// this service holds no database connection and imports no Core Go package.
package main

import (
	"context"
	"log"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/seller/internal/actorapi"
	"github.com/matjeroapps/seller/internal/config"
	"github.com/matjeroapps/seller/internal/coreclient"
	"github.com/matjeroapps/seller/internal/httpx"
	"github.com/matjeroapps/seller/internal/logging"
	"github.com/matjeroapps/seller/internal/observability"
	"github.com/matjeroapps/seller/internal/openapi"
	"github.com/matjeroapps/seller/internal/storefrontapi"
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

	appCfg := httpx.ConfigFrom(cfg)
	router := httpx.NewRouter(httpx.App{
		Config: appCfg,
		Logger: logger,
		// No database and no local dependency to probe; Core reachability is
		// surfaced per request as a 503 rather than failing readiness, so a Core
		// blip does not take every storefront replica out of rotation.
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
				Catalog:  core,
				Platform: cfg,
			})(r)
		},
	}, core, nil))

	return httpx.Run(ctx, appCfg, logger, router)
}

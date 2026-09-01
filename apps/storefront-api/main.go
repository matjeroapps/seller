package main

import (
	"context"
	"log"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/core/packages/config"
	"github.com/matjeroapps/core/packages/database"
	"github.com/matjeroapps/core/packages/httpx"
	"github.com/matjeroapps/core/packages/logging"
	"github.com/matjeroapps/core/packages/observability"
	"github.com/matjeroapps/core/pkg/actorapi"
	"github.com/matjeroapps/core/pkg/commerce"
	"github.com/matjeroapps/core/pkg/markets"
	"github.com/matjeroapps/core/pkg/storefront"
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

	db, err := database.Connect(ctx, cfg)
	if err != nil {
		return err
	}
	defer db.Close()

	marketService := markets.NewService(markets.NewRepository(db.Pool))
	commerceRepo := commerce.NewRepository(db.Pool)
	storefrontDeps := storefrontapi.Dependencies{
		Catalog:  storefront.NewCatalogRepository(db.Pool),
		Stores:   storefront.NewStoreResolver(commerceRepo),
		Platform: cfg,
	}
	appCfg := httpx.ConfigFrom(cfg)
	router := httpx.NewRouter(httpx.App{
		Config: appCfg,
		Logger: logger,
		Ready: func(ctx context.Context) error {
			return db.Ping(ctx)
		},
	})
	if spec, err := openapi.BuildStorefrontSpec(); err == nil {
		if specBytes, err := openapi.MarshalDocument(spec); err == nil {
			router.Mount("/", openapi.NewRouter(openapi.RouterConfig{
				Enabled:   cfg.OpenAPIDocsEnabled,
				SpecPath:  "/openapi.json",
				DocsPath:  "/docs",
				SpecBytes: specBytes,
			}))
		} else {
			return err
		}
	} else {
		return err
	}
	router.Mount("/", actorapi.NewRouter(actorapi.Config{
		AppName:     "Storefront API",
		Actor:       "storefront",
		RequireAuth: false,
		Register: func(r chi.Router) {
			storefrontapi.RegisterStorefrontRoutes(storefrontDeps)(r)
		},
	}, marketService, nil))
	return httpx.Run(ctx, appCfg, logger, router)
}

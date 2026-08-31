package main

import (
	"context"
	"log"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/core/packages/auth"
	"github.com/matjeroapps/core/packages/config"
	"github.com/matjeroapps/core/packages/database"
	"github.com/matjeroapps/core/packages/httpx"
	"github.com/matjeroapps/core/packages/logging"
	"github.com/matjeroapps/core/packages/observability"
	"github.com/matjeroapps/core/pkg/actorapi"
	"github.com/matjeroapps/core/pkg/commerce"
	"github.com/matjeroapps/core/pkg/markets"
	"github.com/matjeroapps/core/pkg/themes"
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

	db, err := database.Connect(ctx, cfg)
	if err != nil {
		return err
	}
	defer db.Close()

	verifier, err := auth.NewOIDCVerifier(ctx, auth.Config{
		IssuerURL:  cfg.ZitadelIssuer,
		Audience:   cfg.ZitadelAudience,
		RolesClaim: auth.DefaultRolesClaim(),
	})
	if err != nil {
		return err
	}

	repo := commerce.NewRepository(db.Pool)
	service := commerce.NewService(repo)
	service.PlatformDomain = cfg.PlatformDomain
	service.ReservedSubdomains = cfg.ReservedSubdomains
	marketService := markets.NewService(markets.NewRepository(db.Pool))
	themeService := themes.NewService(themes.NewRepository(db.Pool), repo, themes.Options{
		PreviewSecret: []byte(cfg.ThemePreviewSecret),
	})
	appCfg := httpx.ConfigFrom(cfg)
	router := httpx.NewRouter(httpx.App{
		Config: appCfg,
		Logger: logger,
		Ready: func(ctx context.Context) error {
			return db.Ping(ctx)
		},
	})
	if spec, err := openapi.BuildSellerSpec(); err == nil {
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
		AppName:      "Seller API",
		Actor:        "seller",
		RequireAuth:  true,
		AllowedRoles: []string{auth.RoleSellerOwner, auth.RoleSellerManager, auth.RoleSellerStaff},
		Register: func(r chi.Router) {
			sellerapi.RegisterSellerRoutes(sellerapi.Dependencies{Commerce: service, Repo: repo})(r)
			sellerapi.RegisterSellerThemeRoutes(sellerapi.ThemeDependencies{Themes: themeService, Commerce: service})(r)
		},
	}, marketService, verifier))
	return httpx.Run(ctx, appCfg, logger, router)
}

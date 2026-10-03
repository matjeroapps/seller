package actorapi

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"seller/internal/api"
	"seller/internal/auth"
	"seller/internal/coreclient"
	"seller/internal/httpx"
	"seller/internal/i18n"
	"seller/internal/markets"
)

type Config struct {
	AppName      string
	Actor        string
	RequireAuth  bool
	AllowedRoles []string
	Register     func(r chi.Router)
	// Console resolves the subject-oriented Merchant bootstrap from Core. It is
	// optional: actors without a Merchant Console integration leave it nil and
	// the bootstrap response simply carries no merchant_console block.
	Console MerchantConsoleService
}

// MerchantConsoleService resolves the Merchant Console bootstrap. It is
// satisfied by *coreclient.Client.
type MerchantConsoleService interface {
	GetMerchantBootstrap(ctx context.Context, subject string) (*coreclient.MerchantBootstrap, error)
}

// MarketService reads market reference data. It is satisfied by
// *coreclient.Client, so market discovery is a Core runtime capability rather
// than a local database read.
type MarketService interface {
	ListMarkets(ctx context.Context, locale i18n.Locale) ([]markets.Market, error)
	GetMarket(ctx context.Context, code string, locale i18n.Locale) (markets.Market, error)
}

type Server struct {
	markets MarketService
	config  Config
}

func NewRouter(config Config, marketService MarketService, verifier auth.Verifier) chi.Router {
	if config.RequireAuth && verifier == nil {
		panic("actor api requires verifier")
	}

	r := chi.NewRouter()
	r.Use(i18n.Middleware(i18n.Default()))

	if config.RequireAuth {
		r.Use(auth.Middleware(verifier))
		if len(config.AllowedRoles) > 0 {
			r.Use(auth.RequireAnyRole(config.AllowedRoles...))
		}
	}

	server := Server{markets: marketService, config: config}

	r.Route("/v1", func(r chi.Router) {
		r.Get("/bootstrap", server.handleBootstrap)
		r.Get("/markets", server.handleMarkets)
		r.Get("/markets/{code}", server.handleMarket)
		if config.Register != nil {
			config.Register(r)
		}
	})

	return r
}

func (s Server) handleBootstrap(w http.ResponseWriter, r *http.Request) {
	principal := auth.PrincipalOrNil(r)
	locale := i18n.FromContext(r.Context())
	marketsList, err := s.markets.ListMarkets(r.Context(), locale)
	if err != nil {
		// A generic message: the underlying cause can name the internal Core
		// host or carry transport detail a customer must never see.
		httpx.WriteError(w, http.StatusInternalServerError, "bootstrap_unavailable", "bootstrap unavailable")
		return
	}

	bootstrap := api.NewBootstrap(
		s.config.AppName,
		s.config.Actor,
		principal,
		locale,
		i18n.SupportedLocales,
		marketsList,
	)

	if s.config.Console != nil && principal != nil {
		console, err := s.config.Console.GetMerchantBootstrap(r.Context(), principal.Subject)
		if err != nil {
			// Core is authoritative for merchant workspaces; a failure here is
			// never masked with an empty or guessed console context.
			var coreErr *coreclient.Error
			if errors.As(err, &coreErr) && coreErr.Status == http.StatusForbidden {
				httpx.WriteError(w, http.StatusForbidden, "merchant_workspace_forbidden", "merchant workspace forbidden")
				return
			}
			httpx.WriteError(w, http.StatusInternalServerError, "bootstrap_unavailable", "bootstrap unavailable")
			return
		}
		consoleBlock := &api.MerchantConsoleBootstrap{
			ContractVersion: console.Meta.ContractVersion,
			Workspaces:      console.Workspaces,
		}
		// The selected workspace is echoed only when the request explicitly
		// names one and Core resolved it as an operable workspace for this
		// principal. It is never guessed and never defaults to the first.
		if selected := strings.TrimSpace(r.URL.Query().Get("merchant_id")); selected != "" {
			valid := false
			for _, ws := range console.Workspaces {
				if ws.MerchantID == selected && ws.Operable() {
					valid = true
					break
				}
			}
			if !valid {
				httpx.WriteError(w, http.StatusForbidden, "merchant_workspace_forbidden", "merchant workspace forbidden")
				return
			}
			consoleBlock.Selected = &selected
		}
		bootstrap.MerchantConsole = consoleBlock
	}

	httpx.WriteJSON(w, http.StatusOK, bootstrap)
}

func (s Server) handleMarkets(w http.ResponseWriter, r *http.Request) {
	locale := i18n.FromContext(r.Context())
	marketsList, err := s.markets.ListMarkets(r.Context(), locale)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "markets_unavailable", "markets unavailable")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"markets": marketsList,
	})
}

func (s Server) handleMarket(w http.ResponseWriter, r *http.Request) {
	locale := i18n.FromContext(r.Context())
	code := chi.URLParam(r, "code")
	market, err := s.markets.GetMarket(r.Context(), code, locale)
	if err != nil {
		var coreErr *coreclient.Error
		if errors.As(err, &coreErr) && coreErr.Code == coreclient.CodeNotFound {
			httpx.WriteError(w, http.StatusNotFound, "market_not_found", "market not found")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "market_unavailable", "market unavailable")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, market)
}

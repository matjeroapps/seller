package sellerapi

import (
	"context"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/seller/internal/actorhttp"
	"github.com/matjeroapps/seller/internal/coreclient"
	"github.com/matjeroapps/seller/internal/httpx"
)

// ThemeCapabilities are the Core theme calls the seller routes depend on. The
// theme business logic (installation, draft editing, atomic publishing, version
// upgrades, preview-token issuance) stays in Core.
type ThemeCapabilities interface {
	ListThemes(ctx context.Context, subject string) ([]coreclient.Theme, error)
	ListThemeVersions(ctx context.Context, key, subject string) ([]coreclient.ThemeVersion, error)
	GetThemeInstallation(ctx context.Context, storeID, subject string) (coreclient.ThemeInstallationResponse, error)
	InstallTheme(ctx context.Context, storeID, subject string, install coreclient.ThemeInstall) (coreclient.ThemeInstallationResponse, error)
	GetThemeDraft(ctx context.Context, storeID, subject string) (coreclient.ThemeDraft, error)
	UpdateThemeDraft(ctx context.Context, storeID, subject string, config map[string]any) (coreclient.ThemeDraft, error)
	PublishTheme(ctx context.Context, storeID, subject string) (coreclient.ThemePublish, error)
	DiscardThemeDraft(ctx context.Context, storeID, subject string) (coreclient.ThemeDraft, error)
	UpgradeTheme(ctx context.Context, storeID, subject, version string) error
	CreateThemePreview(ctx context.Context, storeID, subject string) (coreclient.ThemePreview, error)
}

// ThemeDependencies wires the Theme Engine routes.
type ThemeDependencies struct {
	Themes ThemeCapabilities
}

type themeServer struct {
	deps ThemeDependencies
}

// RegisterSellerThemeRoutes registers seller-scoped Theme management endpoints
// under /v1/seller. Every store-scoped operation is authorized by Core against
// the store's owning seller, so a seller may only manage themes for stores they
// own.
func RegisterSellerThemeRoutes(deps ThemeDependencies) func(r chi.Router) {
	s := themeServer{deps: deps}
	return func(r chi.Router) {
		r.Get("/seller/themes", s.handleListThemes)
		r.Get("/seller/themes/{key}/versions", s.handleListThemeVersions)
		r.Get("/seller/stores/{store_id}/theme", s.handleGetInstallation)
		r.Post("/seller/stores/{store_id}/theme/install", s.handleInstall)
		r.Get("/seller/stores/{store_id}/theme/draft", s.handleGetDraft)
		r.Put("/seller/stores/{store_id}/theme/draft", s.handleUpdateDraft)
		r.Post("/seller/stores/{store_id}/theme/publish", s.handlePublish)
		r.Post("/seller/stores/{store_id}/theme/discard", s.handleDiscardDraft)
		r.Post("/seller/stores/{store_id}/theme/upgrade", s.handleUpgrade)
		r.Post("/seller/stores/{store_id}/theme/preview", s.handleCreatePreview)
	}
}

// subject resolves the authenticated end-user subject forwarded to Core. Core
// resolves the seller identity from it, so a caller cannot act as another seller.
func (s themeServer) subject(w http.ResponseWriter, r *http.Request) (string, bool) {
	subject, err := actorhttp.SubjectFrom(r)
	if err != nil {
		writeThemeError(w, err)
		return "", false
	}
	return subject, true
}

// writeThemeError maps Core theme failures onto the public error contract. The
// status and code for each outcome are unchanged from the pre-migration
// behaviour, so the public contract does not move.
func writeThemeError(w http.ResponseWriter, err error) {
	var coreErr *coreclient.Error
	if errors.As(err, &coreErr) {
		switch coreErr.Code {
		case coreclient.CodeNotFound:
			httpx.WriteError(w, http.StatusNotFound, "not_found", "theme or store not found")
		case coreclient.CodeConflict:
			httpx.WriteError(w, http.StatusConflict, "conflict", "theme version conflict")
		case coreclient.CodeSchemaMismatch:
			httpx.WriteError(w, http.StatusBadRequest, "schema_mismatch", "configuration does not match the theme schema")
		case coreclient.CodeUnsafeContent:
			httpx.WriteError(w, http.StatusBadRequest, "unsafe_content", "configuration contains prohibited executable content")
		case coreclient.CodeValidationError, coreclient.CodeInvalidArgument:
			httpx.WriteError(w, http.StatusBadRequest, "validation_error", "invalid input")
		case coreclient.CodePreviewUnavailable:
			// Misconfiguration, not a client error: preview is unavailable until
			// Core's THEME_PREVIEW_SECRET is set. Never fall back to an unsigned
			// token.
			httpx.WriteError(w, http.StatusServiceUnavailable, "preview_unavailable", "theme preview is not configured")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "internal error")
		}
		return
	}

	if errors.Is(err, coreclient.ErrUnavailable) || errors.Is(err, context.DeadlineExceeded) {
		httpx.WriteError(w, http.StatusServiceUnavailable, "service_unavailable", "service temporarily unavailable")
		return
	}
	httpx.WriteError(w, http.StatusInternalServerError, "internal_error", "internal error")
}

func (s themeServer) handleListThemes(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subject(w, r)
	if !ok {
		return
	}
	items, err := s.deps.Themes.ListThemes(r.Context(), subject)
	if err != nil {
		writeThemeError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ThemeCollectionResponse{Items: items})
}

func (s themeServer) handleListThemeVersions(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subject(w, r)
	if !ok {
		return
	}
	items, err := s.deps.Themes.ListThemeVersions(r.Context(), chi.URLParam(r, "key"), subject)
	if err != nil {
		writeThemeError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ThemeVersionCollectionResponse{Items: items})
}

func (s themeServer) handleGetInstallation(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subject(w, r)
	if !ok {
		return
	}
	installation, err := s.deps.Themes.GetThemeInstallation(r.Context(), chi.URLParam(r, "store_id"), subject)
	if err != nil {
		writeThemeError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ThemeInstallationResponse{
		Installation:      installation.Installation,
		DraftConfig:       installation.DraftConfig,
		PublishedConfig:   installation.PublishedConfig,
		DraftRevision:     installation.DraftRevision,
		PublishedRevision: installation.PublishedRevision,
	})
}

func (s themeServer) handleInstall(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subject(w, r)
	if !ok {
		return
	}
	var body ThemeInstallRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	installation, err := s.deps.Themes.InstallTheme(r.Context(), chi.URLParam(r, "store_id"), subject, coreclient.ThemeInstall{
		ThemeKey: body.ThemeKey,
		Version:  body.Version,
	})
	if err != nil {
		writeThemeError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, ThemeInstallationResponse{Installation: installation.Installation})
}

func (s themeServer) handleGetDraft(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subject(w, r)
	if !ok {
		return
	}
	draft, err := s.deps.Themes.GetThemeDraft(r.Context(), chi.URLParam(r, "store_id"), subject)
	if err != nil {
		writeThemeError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ThemeDraftResponse{Config: draft.Config, Revision: draft.Revision})
}

func (s themeServer) handleUpdateDraft(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subject(w, r)
	if !ok {
		return
	}
	var body ThemeConfigRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	draft, err := s.deps.Themes.UpdateThemeDraft(r.Context(), chi.URLParam(r, "store_id"), subject, body.Config)
	if err != nil {
		writeThemeError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ThemeDraftResponse{Config: draft.Config, Revision: draft.Revision})
}

func (s themeServer) handlePublish(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subject(w, r)
	if !ok {
		return
	}
	published, err := s.deps.Themes.PublishTheme(r.Context(), chi.URLParam(r, "store_id"), subject)
	if err != nil {
		writeThemeError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ThemePublishResponse{PublishedRevision: published.PublishedRevision})
}

func (s themeServer) handleDiscardDraft(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subject(w, r)
	if !ok {
		return
	}
	draft, err := s.deps.Themes.DiscardThemeDraft(r.Context(), chi.URLParam(r, "store_id"), subject)
	if err != nil {
		writeThemeError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ThemeDraftResponse{Config: draft.Config, Revision: draft.Revision})
}

func (s themeServer) handleUpgrade(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subject(w, r)
	if !ok {
		return
	}
	var body ThemeUpgradeRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	if err := s.deps.Themes.UpgradeTheme(r.Context(), chi.URLParam(r, "store_id"), subject, body.Version); err != nil {
		writeThemeError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "upgraded"})
}

func (s themeServer) handleCreatePreview(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subject(w, r)
	if !ok {
		return
	}
	preview, err := s.deps.Themes.CreateThemePreview(r.Context(), chi.URLParam(r, "store_id"), subject)
	if err != nil {
		writeThemeError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ThemePreviewResponse{Token: preview.Token})
}

// --- Theme API request/response types ---

type ThemeCollectionResponse struct {
	Items []coreclient.Theme `json:"items"`
}

type ThemeVersionCollectionResponse struct {
	Items []coreclient.ThemeVersion `json:"items"`
}

type ThemeInstallationResponse struct {
	Installation      coreclient.ThemeInstallation `json:"installation"`
	DraftConfig       map[string]any               `json:"draft_config,omitempty"`
	PublishedConfig   map[string]any               `json:"published_config,omitempty"`
	DraftRevision     int                          `json:"draft_revision"`
	PublishedRevision int                          `json:"published_revision"`
}

type ThemeDraftResponse struct {
	Config   map[string]any `json:"config"`
	Revision int            `json:"revision"`
}

type ThemePublishResponse struct {
	PublishedRevision int `json:"published_revision"`
}

type ThemePreviewResponse struct {
	Token string `json:"token"`
}

type ThemeConfigRequest struct {
	Config map[string]any `json:"config"`
}

type ThemeInstallRequest struct {
	ThemeKey string `json:"theme_key"`
	Version  string `json:"version,omitempty"`
}

type ThemeUpgradeRequest struct {
	Version string `json:"version"`
}

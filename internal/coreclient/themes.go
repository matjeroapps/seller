package coreclient

import (
	"context"
	"net/url"
	"time"
)

// Theme Engine DTOs. The theme business logic stays in Core; these are the wire
// shapes Seller exchanges with it.

// Theme is a registered theme in the platform-controlled catalog.
type Theme struct {
	ID          string    `json:"id"`
	Key         string    `json:"key"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Type        string    `json:"type"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ThemeVersion is a published or draft version of a theme.
type ThemeVersion struct {
	ID                       string         `json:"id"`
	ThemeID                  string         `json:"theme_id"`
	Version                  string         `json:"version"`
	Status                   string         `json:"status"`
	ConfigurationSchema      map[string]any `json:"configuration_schema"`
	DefaultConfiguration     map[string]any `json:"default_configuration"`
	ComponentRegistryVersion string         `json:"component_registry_version"`
	CreatedAt                time.Time      `json:"created_at"`
	PublishedAt              *time.Time     `json:"published_at,omitempty"`
	DeprecatedAt             *time.Time     `json:"deprecated_at,omitempty"`
}

// ThemeInstallation binds a store to a theme version.
type ThemeInstallation struct {
	ID             string    `json:"id"`
	StoreID        string    `json:"store_id"`
	ThemeID        string    `json:"theme_id"`
	ThemeVersionID string    `json:"theme_version_id"`
	Status         string    `json:"status"`
	InstalledAt    time.Time `json:"installed_at"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// ThemeInstallationResponse is the installation plus its configuration state.
type ThemeInstallationResponse struct {
	Installation      ThemeInstallation `json:"installation"`
	DraftConfig       map[string]any    `json:"draft_config,omitempty"`
	PublishedConfig   map[string]any    `json:"published_config,omitempty"`
	DraftRevision     int               `json:"draft_revision"`
	PublishedRevision int               `json:"published_revision"`
}

// ThemeDraft is the draft configuration and its revision.
type ThemeDraft struct {
	Config   map[string]any `json:"config"`
	Revision int            `json:"revision"`
}

// ThemePublish reports the newly published revision.
type ThemePublish struct {
	PublishedRevision int `json:"published_revision"`
}

// ThemePreview carries a signed, short-lived preview token.
type ThemePreview struct {
	Token string `json:"token"`
}

// --- Theme capabilities ---

// ListThemes returns the registered theme catalog.
func (c *Client) ListThemes(ctx context.Context, subject string) ([]Theme, error) {
	var payload collectionResponse[Theme]
	err := c.get(ctx, "/internal/v1/themes", nil, requestOptions{Subject: subject}, &payload)
	return payload.Items, err
}

// ListThemeVersions returns the versions of a theme.
func (c *Client) ListThemeVersions(ctx context.Context, key, subject string) ([]ThemeVersion, error) {
	var payload collectionResponse[ThemeVersion]
	path := "/internal/v1/themes/" + url.PathEscape(key) + "/versions"
	err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	return payload.Items, err
}

// GetThemeInstallation returns a store's active installation and configuration.
func (c *Client) GetThemeInstallation(ctx context.Context, storeID, subject string) (ThemeInstallationResponse, error) {
	var payload ThemeInstallationResponse
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/theme"
	err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	return payload, err
}

// ThemeInstall binds a store to a theme version.
type ThemeInstall struct {
	ThemeKey string `json:"theme_key"`
	Version  string `json:"version,omitempty"`
}

// InstallTheme installs a theme on a store.
func (c *Client) InstallTheme(ctx context.Context, storeID, subject string, install ThemeInstall) (ThemeInstallationResponse, error) {
	var payload ThemeInstallationResponse
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/theme/install"
	err := c.post(ctx, path, install, requestOptions{Subject: subject}, &payload)
	return payload, err
}

// GetThemeDraft returns a store's draft configuration.
func (c *Client) GetThemeDraft(ctx context.Context, storeID, subject string) (ThemeDraft, error) {
	var payload ThemeDraft
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/theme/draft"
	err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	return payload, err
}

// ThemeConfig replaces a store's draft configuration.
type ThemeConfig struct {
	Config map[string]any `json:"config"`
}

// UpdateThemeDraft replaces a store's draft configuration.
func (c *Client) UpdateThemeDraft(ctx context.Context, storeID, subject string, config map[string]any) (ThemeDraft, error) {
	var payload ThemeDraft
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/theme/draft"
	err := c.put(ctx, path, ThemeConfig{Config: config}, requestOptions{Subject: subject}, &payload)
	return payload, err
}

// PublishTheme publishes a store's draft configuration.
func (c *Client) PublishTheme(ctx context.Context, storeID, subject string) (ThemePublish, error) {
	var payload ThemePublish
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/theme/publish"
	err := c.post(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	return payload, err
}

// DiscardThemeDraft resets a store's draft to the published configuration.
func (c *Client) DiscardThemeDraft(ctx context.Context, storeID, subject string) (ThemeDraft, error) {
	var payload ThemeDraft
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/theme/discard"
	err := c.post(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	return payload, err
}

// ThemeUpgrade points an installation at a newer published version.
type ThemeUpgrade struct {
	Version string `json:"version"`
}

// UpgradeTheme upgrades a store to a newer published theme version.
func (c *Client) UpgradeTheme(ctx context.Context, storeID, subject, version string) error {
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/theme/upgrade"
	return c.post(ctx, path, ThemeUpgrade{Version: version}, requestOptions{Subject: subject}, &statusResponse{})
}

// CreateThemePreview issues a signed preview token for a store's draft.
func (c *Client) CreateThemePreview(ctx context.Context, storeID, subject string) (ThemePreview, error) {
	var payload ThemePreview
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/theme/preview"
	err := c.post(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	return payload, err
}

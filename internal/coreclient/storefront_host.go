package coreclient

import (
	"context"
	"fmt"
	"net/url"
	"strings"
)

// StorefrontHostResponse is the Seller-owned wire DTO for Core's storefront host
// discovery response.
type StorefrontHostResponse struct {
	Host string `json:"host"`
}

// GetStorefrontHost fetches the active, primary, normalized bare storefront host for a store.
// Core authorizes the caller's store ownership.
func (c *Client) GetStorefrontHost(ctx context.Context, storeID, subject string) (string, error) {
	var payload StorefrontHostResponse
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/storefront-host"
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &payload); err != nil {
		return "", err
	}

	host := strings.TrimSpace(payload.Host)
	if host == "" {
		return "", fmt.Errorf("coreclient: %w: empty storefront host", ErrUnavailable)
	}
	if strings.Contains(host, "://") || strings.Contains(host, "/") || strings.Contains(host, "@") || strings.Contains(host, ":") {
		return "", fmt.Errorf("coreclient: %w: invalid storefront host format", ErrUnavailable)
	}

	return host, nil
}

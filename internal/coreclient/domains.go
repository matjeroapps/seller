package coreclient

import (
	"context"
	"net/url"
	"time"
)

// StoreDomain represents a storefront domain associated with a store.
type StoreDomain struct {
	ID            string              `json:"id"`
	StoreID       string              `json:"store_id"`
	Domain        string              `json:"domain"`
	IsPrimary     bool                `json:"is_primary"`
	VerifiedAt    *time.Time          `json:"verified_at,omitempty"`
	Status        string              `json:"status"`
	DomainType    string              `json:"domain_type"`
	LastCheckedAt *time.Time          `json:"last_checked_at,omitempty"`
	Verification  *DomainVerification `json:"verification,omitempty"`
	CreatedAt     time.Time           `json:"created_at"`
	UpdatedAt     time.Time           `json:"updated_at"`
}

// DomainVerification describes the DNS TXT record challenge for custom domain ownership verification.
type DomainVerification struct {
	RecordType  string `json:"record_type"`
	RecordName  string `json:"record_name"`
	RecordValue string `json:"record_value"`
}

// CustomDomainRequest carries input for requesting a custom storefront domain.
type CustomDomainRequest struct {
	Domain string `json:"domain"`
}

// ListStoreDomains returns all domains for a store.
func (c *Client) ListStoreDomains(ctx context.Context, storeID, subject string) ([]StoreDomain, error) {
	var payload collectionResponse[StoreDomain]
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/domains"
	err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	return payload.Items, err
}

// RequestCustomDomain requests a new custom domain for a store.
func (c *Client) RequestCustomDomain(ctx context.Context, storeID, subject, domain string) (StoreDomain, error) {
	var payload StoreDomain
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/domains"
	err := c.post(ctx, path, CustomDomainRequest{Domain: domain}, requestOptions{Subject: subject}, &payload)
	return payload, err
}

// VerifyCustomDomain triggers DNS verification check for a custom domain.
func (c *Client) VerifyCustomDomain(ctx context.Context, storeID, domainID, subject string) (StoreDomain, error) {
	var payload StoreDomain
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/domains/" + url.PathEscape(domainID) + "/verify"
	err := c.post(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	return payload, err
}

// ActivateCustomDomain activates a verified custom domain as the store's primary domain.
func (c *Client) ActivateCustomDomain(ctx context.Context, storeID, domainID, subject string) (StoreDomain, error) {
	var payload StoreDomain
	path := "/internal/v1/stores/" + url.PathEscape(storeID) + "/domains/" + url.PathEscape(domainID) + "/activate"
	err := c.post(ctx, path, nil, requestOptions{Subject: subject}, &payload)
	return payload, err
}

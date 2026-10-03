package coreclient

// Merchant Console contracts (Feature 025). These DTOs are owned by Seller, so
// a Core domain change cannot silently become a Seller public contract change.
// The browser only ever sees the Seller API surfaces; Core service credentials
// and the Core endpoints below are never exposed to it.

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"time"
)

// MerchantBootstrap is the subject-oriented workspace resolution returned by
// Core. Workspaces MAY be empty: a principal without a canonical Merchant
// membership has no workspace and no default is ever selected.
type MerchantBootstrap struct {
	Subject    string                `json:"subject"`
	Workspaces []MerchantWorkspace   `json:"workspaces"`
	Meta       MerchantBootstrapMeta `json:"meta"`
}

// MerchantBootstrapMeta carries contract/version metadata for safe frontend
// feature detection.
type MerchantBootstrapMeta struct {
	ContractVersion string    `json:"contract_version"`
	GeneratedAt     time.Time `json:"generated_at"`
}

// MerchantWorkspace is one Merchant workspace the principal holds a membership
// in. For non-operable workspaces (invited/suspended membership or suspended
// merchant) Core exposes only identity/status facts.
type MerchantWorkspace struct {
	MerchantID     string                           `json:"merchant_id"`
	MerchantCode   string                           `json:"merchant_code"`
	LegalName      string                           `json:"legal_name"`
	MerchantStatus string                           `json:"merchant_status"`
	Membership     MerchantWorkspaceMembership      `json:"membership"`
	Capabilities   *MerchantWorkspaceCapabilities   `json:"capabilities,omitempty"`
	Stores         []MerchantWorkspaceStore         `json:"stores"`
	PlanSummary    *MerchantWorkspacePlanSummary    `json:"plan_summary,omitempty"`
	PendingActions *MerchantWorkspacePendingActions `json:"pending_actions,omitempty"`
}

// Operable reports whether the workspace may render merchant-scoped content:
// the merchant is active and the membership is active.
func (w MerchantWorkspace) Operable() bool {
	return w.MerchantStatus == "active" && w.Membership.Status == "active"
}

// MerchantWorkspaceMembership is the principal's membership in the workspace.
type MerchantWorkspaceMembership struct {
	ID          string   `json:"id"`
	Status      string   `json:"status"`
	Permissions []string `json:"permissions"`
}

// MerchantWorkspaceCapabilities is the Retail/Supply capability state.
type MerchantWorkspaceCapabilities struct {
	Retail *MerchantWorkspaceCapability `json:"retail"`
	Supply *MerchantWorkspaceCapability `json:"supply"`
}

// MerchantWorkspaceCapability carries one capability state.
type MerchantWorkspaceCapability struct {
	Status string `json:"status"`
}

// MerchantWorkspaceStore is one authorized store inside the workspace.
type MerchantWorkspaceStore struct {
	ID         string `json:"id"`
	Code       string `json:"code"`
	Name       string `json:"name"`
	Status     string `json:"status"`
	MarketCode string `json:"market_code"`
}

// MerchantWorkspacePlanSummary is the honest plan state (NO_PLAN_MODEL until a
// plan source exists).
type MerchantWorkspacePlanSummary struct {
	State string `json:"state"`
}

// MerchantWorkspacePendingActions counts actions owed by the Merchant, derived
// from persisted rows only.
type MerchantWorkspacePendingActions struct {
	OpenReviewCases      int `json:"open_review_cases"`
	UnhealthyConnections int `json:"unhealthy_connections"`
}

// GetMerchantBootstrap calls Core's subject-oriented bootstrap with the Seller
// service identity, forwarding only the verified principal subject.
func (c *Client) GetMerchantBootstrap(ctx context.Context, subject string) (*MerchantBootstrap, error) {
	var out MerchantBootstrap
	if err := c.get(ctx, "/internal/v1/merchants/bootstrap", nil, requestOptions{Subject: subject}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// SupplyImportBatch is one provider import pass for a supply connection.
type SupplyImportBatch struct {
	ID             string    `json:"id"`
	MerchantID     string    `json:"merchant_id"`
	ConnectionID   string    `json:"connection_id"`
	Provider       string    `json:"provider"`
	BatchType      string    `json:"batch_type"`
	Status         string    `json:"status"`
	FirstImport    bool      `json:"first_import"`
	RecordCount    int       `json:"record_count"`
	ApprovedCount  int       `json:"approved_count"`
	RejectedCount  int       `json:"rejected_count"`
	DuplicateCount int       `json:"duplicate_count"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	CursorToken    *string   `json:"cursor_token,omitempty"`
}

// SupplyImportRecord is one staged external fact inside a batch.
type SupplyImportRecord struct {
	ID                string    `json:"id"`
	BatchID           string    `json:"batch_id"`
	MerchantID        string    `json:"merchant_id"`
	ConnectionID      string    `json:"connection_id"`
	EntityType        string    `json:"entity_type"`
	ExternalProductID string    `json:"external_product_id"`
	ExternalVariantID *string   `json:"external_variant_id,omitempty"`
	SKU               *string   `json:"sku,omitempty"`
	Barcode           *string   `json:"barcode,omitempty"`
	Title             *string   `json:"title,omitempty"`
	Currency          *string   `json:"currency,omitempty"`
	Status            string    `json:"status"`
	ReviewCaseID      *string   `json:"review_case_id,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// SupplyImportBatchDetail is a batch with its staged records.
type SupplyImportBatchDetail struct {
	Batch   *SupplyImportBatch   `json:"batch"`
	Records []SupplyImportRecord `json:"records"`
}

// SupplyReviewCase is one operational review case.
type SupplyReviewCase struct {
	ID           string          `json:"id"`
	MerchantID   string          `json:"merchant_id"`
	ConnectionID string          `json:"connection_id"`
	CaseType     string          `json:"case_type"`
	Status       string          `json:"status"`
	ReasonCode   string          `json:"reason_code"`
	Details      json.RawMessage `json:"details"`
	Resolution   *string         `json:"resolution,omitempty"`
	ResolvedBy   *string         `json:"resolved_by,omitempty"`
	ResolvedAt   *time.Time      `json:"resolved_at,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// SupplyMapping is one approved entity correlation with authority/provenance.
type SupplyMapping struct {
	ID                string          `json:"id"`
	MerchantID        string          `json:"merchant_id"`
	ConnectionID      string          `json:"connection_id"`
	EntityType        string          `json:"entity_type"`
	InternalID        string          `json:"internal_id"`
	ExternalProductID string          `json:"external_product_id"`
	ExternalVariantID *string         `json:"external_variant_id,omitempty"`
	ExternalVersion   *string         `json:"external_version,omitempty"`
	AuthoritySource   string          `json:"authority_source"`
	Provenance        json.RawMessage `json:"provenance"`
	Status            string          `json:"status"`
	LastSyncedAt      *time.Time      `json:"last_synced_at,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
}

// SupplyCursor is the durable per-connection/per-entity sync state.
type SupplyCursor struct {
	ID                 string     `json:"id"`
	ConnectionID       string     `json:"connection_id"`
	EntityType         string     `json:"entity_type"`
	CursorToken        *string    `json:"cursor_token,omitempty"`
	LastSuccessfulSync *time.Time `json:"last_successful_sync,omitempty"`
	LastReconciledAt   *time.Time `json:"last_reconciled_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// SupplyFulfillmentRequest is one outbound supplier fulfillment work item.
type SupplyFulfillmentRequest struct {
	ID                    string          `json:"id"`
	MerchantID            string          `json:"merchant_id"`
	ConnectionID          string          `json:"connection_id"`
	Status                string          `json:"status"`
	Payload               json.RawMessage `json:"payload"`
	ExternalFulfillmentID *string         `json:"external_fulfillment_id,omitempty"`
	Provider              string          `json:"provider"`
	CreatedAt             time.Time       `json:"created_at"`
	UpdatedAt             time.Time       `json:"updated_at"`
}

// SupplyTrackingEvent is one imported external fulfillment/tracking state.
type SupplyTrackingEvent struct {
	ID              string     `json:"id"`
	RequestID       string     `json:"request_id"`
	ConnectionID    string     `json:"connection_id"`
	ExternalEventID string     `json:"external_event_id"`
	Status          string     `json:"status"`
	Carrier         *string    `json:"carrier,omitempty"`
	TrackingNumber  *string    `json:"tracking_number,omitempty"`
	OccurredAt      *time.Time `json:"occurred_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

// SupplyFulfillmentRequestDetail is a fulfillment request with its tracking
// events.
type SupplyFulfillmentRequestDetail struct {
	Request        *SupplyFulfillmentRequest `json:"request"`
	TrackingEvents []SupplyTrackingEvent     `json:"tracking_events"`
}

// SupplyConnection is one merchant-owned integration connection.
type SupplyConnection struct {
	ID             string    `json:"id"`
	MerchantID     string    `json:"merchant_id"`
	ConnectionType string    `json:"connection_type"`
	Provider       string    `json:"provider"`
	Name           string    `json:"name"`
	Status         string    `json:"status"`
	HealthStatus   string    `json:"health_status"`
	StoreID        *string   `json:"store_id,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func supplyListValues(connectionID, status string, limit, offset int) url.Values {
	values := make(url.Values)
	if connectionID != "" {
		values.Set("connection_id", connectionID)
	}
	if status != "" {
		values.Set("status", status)
	}
	if limit > 0 {
		values.Set("limit", strconv.Itoa(limit))
	}
	if offset > 0 {
		values.Set("offset", strconv.Itoa(offset))
	}
	return values
}

func merchantSupplyPath(merchantID string, parts ...string) string {
	path := "/internal/v1/merchants/" + url.PathEscape(merchantID) + "/integrations/supply"
	for _, part := range parts {
		path += "/" + url.PathEscape(part)
	}
	return path
}

// ListSupplyImportBatches lists the Merchant's own import batches.
func (c *Client) ListSupplyImportBatches(ctx context.Context, subject, merchantID, connectionID, status string, limit, offset int) ([]SupplyImportBatch, error) {
	var out []SupplyImportBatch
	if err := c.get(ctx, merchantSupplyPath(merchantID, "import-batches"), supplyListValues(connectionID, status, limit, offset), requestOptions{Subject: subject}, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetSupplyImportBatch returns one of the Merchant's batches with its staged
// records. A foreign ID is indistinguishable from a missing one.
func (c *Client) GetSupplyImportBatch(ctx context.Context, subject, merchantID, batchID string) (*SupplyImportBatchDetail, error) {
	var out SupplyImportBatchDetail
	if err := c.get(ctx, merchantSupplyPath(merchantID, "import-batches", batchID), nil, requestOptions{Subject: subject}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ListSupplyReviewCases lists the Merchant's review cases.
func (c *Client) ListSupplyReviewCases(ctx context.Context, subject, merchantID, connectionID, status string) ([]SupplyReviewCase, error) {
	var out []SupplyReviewCase
	if err := c.get(ctx, merchantSupplyPath(merchantID, "review-cases"), supplyListValues(connectionID, status, 0, 0), requestOptions{Subject: subject}, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetSupplyReviewCase returns one of the Merchant's review cases.
func (c *Client) GetSupplyReviewCase(ctx context.Context, subject, merchantID, caseID string) (*SupplyReviewCase, error) {
	var out SupplyReviewCase
	if err := c.get(ctx, merchantSupplyPath(merchantID, "review-cases", caseID), nil, requestOptions{Subject: subject}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ListSupplyMappings lists the Merchant's entity mappings.
func (c *Client) ListSupplyMappings(ctx context.Context, subject, merchantID, connectionID string) ([]SupplyMapping, error) {
	var out []SupplyMapping
	if err := c.get(ctx, merchantSupplyPath(merchantID, "mappings"), supplyListValues(connectionID, "", 0, 0), requestOptions{Subject: subject}, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetSupplyMapping returns one of the Merchant's mappings.
func (c *Client) GetSupplyMapping(ctx context.Context, subject, merchantID, mappingID string) (*SupplyMapping, error) {
	var out SupplyMapping
	if err := c.get(ctx, merchantSupplyPath(merchantID, "mappings", mappingID), nil, requestOptions{Subject: subject}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ListSupplyCursors lists the sync state of the Merchant's connections.
func (c *Client) ListSupplyCursors(ctx context.Context, subject, merchantID, connectionID string) ([]SupplyCursor, error) {
	var out []SupplyCursor
	if err := c.get(ctx, merchantSupplyPath(merchantID, "cursors"), supplyListValues(connectionID, "", 0, 0), requestOptions{Subject: subject}, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListSupplyFulfillmentRequests lists the Merchant's fulfillment requests.
func (c *Client) ListSupplyFulfillmentRequests(ctx context.Context, subject, merchantID, connectionID, status string, limit, offset int) ([]SupplyFulfillmentRequest, error) {
	var out []SupplyFulfillmentRequest
	if err := c.get(ctx, merchantSupplyPath(merchantID, "fulfillment-requests"), supplyListValues(connectionID, status, limit, offset), requestOptions{Subject: subject}, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetSupplyFulfillmentRequest returns one of the Merchant's fulfillment requests
// with its tracking events.
func (c *Client) GetSupplyFulfillmentRequest(ctx context.Context, subject, merchantID, requestID string) (*SupplyFulfillmentRequestDetail, error) {
	var out SupplyFulfillmentRequestDetail
	if err := c.get(ctx, merchantSupplyPath(merchantID, "fulfillment-requests", requestID), nil, requestOptions{Subject: subject}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ListSupplyConnections lists the Merchant's supply connections.
func (c *Client) ListSupplyConnections(ctx context.Context, subject, merchantID, connectionType string) ([]SupplyConnection, error) {
	values := make(url.Values)
	if connectionType != "" {
		values.Set("connection_type", connectionType)
	}
	var out []SupplyConnection
	path := "/internal/v1/merchants/" + url.PathEscape(merchantID) + "/integrations/connections"
	if err := c.get(ctx, path, values, requestOptions{Subject: subject}, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetSupplyConnection returns one of the Merchant's connections.
func (c *Client) GetSupplyConnection(ctx context.Context, subject, merchantID, connectionID string) (*SupplyConnection, error) {
	var out SupplyConnection
	path := fmt.Sprintf("/internal/v1/merchants/%s/integrations/connections/%s", url.PathEscape(merchantID), url.PathEscape(connectionID))
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

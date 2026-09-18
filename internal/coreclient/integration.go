package coreclient

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"time"
)

type ConnectionResponse struct {
	ID                  string          `json:"id"`
	ActorType           string          `json:"actor_type"`
	ActorID             string          `json:"actor_id"`
	Provider            string          `json:"provider"`
	Name                string          `json:"name"`
	Status              string          `json:"status"`
	CredentialsVaultRef string          `json:"credentials_vault_ref,omitempty"`
	Settings            json.RawMessage `json:"settings"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
}

type CreateConnectionPayload struct {
	ActorType           string          `json:"actor_type"`
	ActorID             string          `json:"actor_id"`
	Provider            string          `json:"provider"`
	Name                string          `json:"name"`
	CredentialsVaultRef string          `json:"credentials_vault_ref,omitempty"`
	Settings            json.RawMessage `json:"settings,omitempty"`
}

type EntityMappingResponse struct {
	ID              string          `json:"id"`
	ConnectionID    string          `json:"connection_id"`
	EntityType      string          `json:"entity_type"`
	InternalID      string          `json:"internal_id"`
	ExternalID      string          `json:"external_id"`
	ExternalVersion string          `json:"external_version,omitempty"`
	MappingStatus   string          `json:"mapping_status"`
	SyncDirection   string          `json:"sync_direction"`
	ConflictStatus  string          `json:"conflict_status,omitempty"`
	Metadata        json.RawMessage `json:"metadata"`
	LastSyncedAt    time.Time       `json:"last_synced_at"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

type UpsertEntityMappingPayload struct {
	ConnectionID    string          `json:"connection_id"`
	EntityType      string          `json:"entity_type"`
	InternalID      string          `json:"internal_id"`
	ExternalID      string          `json:"external_id"`
	ExternalVersion string          `json:"external_version,omitempty"`
	MappingStatus   string          `json:"mapping_status,omitempty"`
	SyncDirection   string          `json:"sync_direction,omitempty"`
	ConflictStatus  string          `json:"conflict_status,omitempty"`
	Metadata        json.RawMessage `json:"metadata,omitempty"`
}

func (c *Client) CreateConnection(ctx context.Context, subject string, req CreateConnectionPayload) (*ConnectionResponse, error) {
	var conn ConnectionResponse
	if err := c.post(ctx, "/internal/v1/integrations/connections", req, requestOptions{Subject: subject}, &conn); err != nil {
		return nil, err
	}
	return &conn, nil
}

func (c *Client) ListConnections(ctx context.Context, subject, actorType, actorID string) ([]ConnectionResponse, error) {
	path := fmt.Sprintf("/internal/v1/integrations/connections?actor_type=%s&actor_id=%s", url.QueryEscape(actorType), url.QueryEscape(actorID))
	var res CoreCollectionResponse[ConnectionResponse]
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &res); err != nil {
		return []ConnectionResponse{}, nil
	}
	return res.Items, nil
}

func (c *Client) UpsertEntityMapping(ctx context.Context, subject string, req UpsertEntityMappingPayload) (*EntityMappingResponse, error) {
	var mapping EntityMappingResponse
	if err := c.post(ctx, "/internal/v1/integrations/mappings", req, requestOptions{Subject: subject}, &mapping); err != nil {
		return nil, err
	}
	return &mapping, nil
}

func (c *Client) ListEntityMappings(ctx context.Context, subject, connectionID, entityType string) ([]EntityMappingResponse, error) {
	path := fmt.Sprintf("/internal/v1/integrations/mappings?connection_id=%s&entity_type=%s", url.QueryEscape(connectionID), url.QueryEscape(entityType))
	var res CoreCollectionResponse[EntityMappingResponse]
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &res); err != nil {
		return []EntityMappingResponse{}, nil
	}
	return res.Items, nil
}

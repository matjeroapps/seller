package sellerapi

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"seller/internal/coreclient"
	"seller/internal/httpx"
)

type createStoreConnectionPayload struct {
	Provider            string          `json:"provider"`
	Name                string          `json:"name"`
	CredentialsVaultRef string          `json:"credentials_vault_ref,omitempty"`
	Settings            json.RawMessage `json:"settings,omitempty"`
}

func (deps Dependencies) handleListStoreConnections(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	conns, err := deps.Core.ListConnections(r.Context(), subject, "seller", storeID)
	if err != nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": []any{}})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": conns})
}

func (deps Dependencies) handleCreateStoreConnection(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	var body createStoreConnectionPayload
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid request body"})
		return
	}

	conn, err := deps.Core.CreateConnection(r.Context(), subject, coreclient.CreateConnectionPayload{
		ActorType:           "seller",
		ActorID:             storeID,
		Provider:            body.Provider,
		Name:                body.Name,
		CredentialsVaultRef: body.CredentialsVaultRef,
		Settings:            body.Settings,
	})
	if err != nil {
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, conn)
}

func (deps Dependencies) handleListStoreEntityMappings(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}

	connectionID := r.URL.Query().Get("connection_id")
	entityType := r.URL.Query().Get("entity_type")

	mappings, err := deps.Core.ListEntityMappings(r.Context(), subject, connectionID, entityType)
	if err != nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": []any{}})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": mappings})
}

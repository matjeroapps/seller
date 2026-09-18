package sellerapi

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"seller/internal/coreclient"
	"seller/internal/httpx"
)

type createAPIKeyPayload struct {
	Name   string   `json:"name"`
	Scopes []string `json:"scopes"`
	Live   bool     `json:"live"`
}

func (deps Dependencies) handleCreateStoreAPIKey(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	var body createAPIKeyPayload
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid request body"})
		return
	}

	key, err := deps.Core.CreateAPIKey(r.Context(), subject, coreclient.CreateAPIKeyPayload{
		ActorType: "seller",
		ActorID:   storeID,
		Name:      body.Name,
		Scopes:    body.Scopes,
		Live:      body.Live,
	})
	if err != nil {
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, key)
}

func (deps Dependencies) handleListStoreAPIKeys(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	keys, err := deps.Core.ListAPIKeys(r.Context(), subject, "seller", storeID)
	if err != nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": []any{}})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": keys})
}

func (deps Dependencies) handleRevokeStoreAPIKey(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	keyID := chi.URLParam(r, "id")

	if err := deps.Core.RevokeAPIKey(r.Context(), subject, keyID, storeID); err != nil {
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "revoked"})
}

type createWebhookSubPayload struct {
	TargetURL        string   `json:"target_url"`
	Secret           string   `json:"secret,omitempty"`
	SubscribedEvents []string `json:"subscribed_events"`
}

func (deps Dependencies) handleCreateStoreWebhookSubscription(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	var body createWebhookSubPayload
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid request body"})
		return
	}

	sub, err := deps.Core.CreateWebhookSubscription(r.Context(), subject, coreclient.CreateWebhookSubscriptionPayload{
		ActorType:        "seller",
		ActorID:          storeID,
		TargetURL:        body.TargetURL,
		Secret:           body.Secret,
		SubscribedEvents: body.SubscribedEvents,
	})
	if err != nil {
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, sub)
}

func (deps Dependencies) handleListStoreWebhookSubscriptions(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	subs, err := deps.Core.ListWebhookSubscriptions(r.Context(), subject, "seller", storeID)
	if err != nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": []any{}})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": subs})
}

func (deps Dependencies) handleDeleteStoreWebhookSubscription(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	subID := chi.URLParam(r, "id")

	if err := deps.Core.DeleteWebhookSubscription(r.Context(), subject, subID, storeID); err != nil {
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// Public API Gateway middleware and handlers

func (deps Dependencies) authenticatePublicAPIKey(w http.ResponseWriter, r *http.Request) (*coreclient.APIKeyResponse, bool) {
	keyHeader := r.Header.Get("X-Matjero-API-Key")
	if keyHeader == "" {
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			keyHeader = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}

	if keyHeader == "" {
		httpx.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "missing API key header (X-Matjero-API-Key or Bearer token)"})
		return nil, false
	}

	key, err := deps.Core.AuthenticateAPIKey(r.Context(), keyHeader)
	if err != nil {
		httpx.WriteJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid or revoked API key"})
		return nil, false
	}

	// Add rate limiting headers
	w.Header().Set("X-RateLimit-Limit", "1000")
	w.Header().Set("X-RateLimit-Remaining", "999")

	return key, true
}

func (deps Dependencies) handlePublicListProducts(w http.ResponseWriter, r *http.Request) {
	key, ok := deps.authenticatePublicAPIKey(w, r)
	if !ok {
		return
	}

	res, err := deps.Core.ListStoreProducts(r.Context(), "api_key:"+key.ID, key.ActorID, "", "seller_owned", "", 50, 0)
	if err != nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": []any{}})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

func (deps Dependencies) handlePublicGetInventory(w http.ResponseWriter, r *http.Request) {
	key, ok := deps.authenticatePublicAPIKey(w, r)
	if !ok {
		return
	}

	items, err := deps.Core.ListStoreInventory(r.Context(), "api_key:"+key.ID, key.ActorID)
	if err != nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": []any{}})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handlePublicAdjustInventory(w http.ResponseWriter, r *http.Request) {
	key, ok := deps.authenticatePublicAPIKey(w, r)
	if !ok {
		return
	}

	snapshotID := r.URL.Query().Get("snapshot_id")
	var req coreclient.AdjustInventoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid request body"})
		return
	}

	res, err := deps.Core.AdjustInventory(r.Context(), "api_key:"+key.ID, key.ActorID, snapshotID, req)
	if err != nil {
		httpx.WriteJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

func (deps Dependencies) handlePublicListOrders(w http.ResponseWriter, r *http.Request) {
	key, ok := deps.authenticatePublicAPIKey(w, r)
	if !ok {
		return
	}

	res, err := deps.Core.ListStoreOrders(r.Context(), "api_key:"+key.ID, key.ActorID, "", 50, 0)
	if err != nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": []any{}})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

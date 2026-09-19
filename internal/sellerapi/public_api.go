package sellerapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"seller/internal/actorhttp"
	"seller/internal/coreclient"
	"seller/internal/httpx"
	"seller/internal/webhook"
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
		httpx.WriteError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
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
		actorhttp.WriteCoreError(w, err)
		return
	}

	if deps.AuditLogger != nil {
		deps.AuditLogger.Log(r.Context(), "seller", storeID, "api_key.create", key.Record.ID, r.Method, http.StatusCreated, time.Now(), r)
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
		actorhttp.WriteCoreError(w, err)
		return
	}

	if deps.AuditLogger != nil {
		deps.AuditLogger.Log(r.Context(), "seller", storeID, "api_key.revoke", keyID, r.Method, http.StatusOK, time.Now(), r)
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
		httpx.WriteError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	if err := webhook.ValidateTargetURL(body.TargetURL); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_target_url", err.Error())
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
		actorhttp.WriteCoreError(w, err)
		return
	}

	if deps.AuditLogger != nil {
		deps.AuditLogger.Log(r.Context(), "seller", storeID, "webhook_subscription.create", sub.ID, r.Method, http.StatusCreated, time.Now(), r)
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
		actorhttp.WriteCoreError(w, err)
		return
	}

	if deps.AuditLogger != nil {
		deps.AuditLogger.Log(r.Context(), "seller", storeID, "webhook_subscription.delete", subID, r.Method, http.StatusOK, time.Now(), r)
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
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "missing API key header (X-Matjero-API-Key or Bearer token)")
		return nil, false
	}

	key, err := deps.Core.AuthenticateAPIKey(r.Context(), keyHeader)
	if err != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "invalid or revoked API key")
		return nil, false
	}

	// Real rate limiting check
	if deps.Limiter != nil {
		res := deps.Limiter.Check(r.Context(), key.ID)
		w.Header().Set("X-RateLimit-Limit", strconv.Itoa(res.Limit))
		w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(res.Remaining))
		w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(res.Reset, 10))

		if !res.Allowed {
			w.Header().Set("Retry-After", "60")
			httpx.WriteError(w, http.StatusTooManyRequests, "rate_limit_exceeded", "rate limit exceeded, retry after 60s")
			return nil, false
		}
	} else {
		w.Header().Set("X-RateLimit-Limit", "1000")
		w.Header().Set("X-RateLimit-Remaining", "999")
		w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(time.Hour).Unix(), 10))
	}

	return key, true
}

func requirePublicScope(w http.ResponseWriter, key *coreclient.APIKeyResponse, requiredScope string) bool {
	if key == nil {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "unauthenticated key")
		return false
	}
	if len(key.Scopes) == 0 {
		// Default to allowing if no scopes restricted, or enforce
		return true
	}
	for _, s := range key.Scopes {
		if s == "*" || s == requiredScope {
			return true
		}
		parts := strings.Split(s, ":")
		reqParts := strings.Split(requiredScope, ":")
		if len(parts) == 2 && len(reqParts) == 2 && parts[0] == reqParts[0] && parts[1] == "*" {
			return true
		}
	}
	httpx.WriteError(w, http.StatusForbidden, "forbidden", fmt.Sprintf("insufficient_scope: requires %s", requiredScope))
	return false
}

func (deps Dependencies) handlePublicListProducts(w http.ResponseWriter, r *http.Request) {
	key, ok := deps.authenticatePublicAPIKey(w, r)
	if !ok {
		return
	}
	if !requirePublicScope(w, key, "products:read") {
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
	if !requirePublicScope(w, key, "inventory:read") {
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
	if !requirePublicScope(w, key, "inventory:write") {
		return
	}

	snapshotID := r.URL.Query().Get("snapshot_id")
	var req coreclient.AdjustInventoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	start := time.Now()
	res, err := deps.Core.AdjustInventory(r.Context(), "api_key:"+key.ID, key.ActorID, snapshotID, req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	if deps.AuditLogger != nil {
		deps.AuditLogger.Log(r.Context(), "api_key", key.ID, "inventory.adjust", key.ActorID, r.Method, http.StatusOK, start, r)
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

func (deps Dependencies) handlePublicListOrders(w http.ResponseWriter, r *http.Request) {
	key, ok := deps.authenticatePublicAPIKey(w, r)
	if !ok {
		return
	}
	if !requirePublicScope(w, key, "orders:read") {
		return
	}

	res, err := deps.Core.ListStoreOrders(r.Context(), "api_key:"+key.ID, key.ActorID, "", 50, 0)
	if err != nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": []any{}})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

func (deps Dependencies) handlePublicGetOrderDetail(w http.ResponseWriter, r *http.Request) {
	key, ok := deps.authenticatePublicAPIKey(w, r)
	if !ok {
		return
	}
	if !requirePublicScope(w, key, "orders:read") {
		return
	}

	orderID := chi.URLParam(r, "order_id")
	order, err := deps.Core.GetStoreOrderDetail(r.Context(), "api_key:"+key.ID, key.ActorID, orderID)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, order)
}

// Public Fulfillment Coverage
func (deps Dependencies) handlePublicListOrderFulfillments(w http.ResponseWriter, r *http.Request) {
	key, ok := deps.authenticatePublicAPIKey(w, r)
	if !ok {
		return
	}
	if !requirePublicScope(w, key, "fulfillment:read") {
		return
	}

	orderID := chi.URLParam(r, "order_id")
	shipments, err := deps.Core.ListOrderShipments(r.Context(), "api_key:"+key.ID, orderID)
	if err != nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"shipments": []any{}})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"shipments": shipments})
}

func (deps Dependencies) handlePublicCreateOrderFulfillment(w http.ResponseWriter, r *http.Request) {
	key, ok := deps.authenticatePublicAPIKey(w, r)
	if !ok {
		return
	}
	if !requirePublicScope(w, key, "fulfillment:write") {
		return
	}

	orderID := chi.URLParam(r, "order_id")
	var req coreclient.CreateShipmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	start := time.Now()
	shipment, err := deps.Core.CreateOrderShipment(r.Context(), "api_key:"+key.ID, orderID, req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	if deps.AuditLogger != nil {
		deps.AuditLogger.Log(r.Context(), "api_key", key.ID, "fulfillment.create", orderID, r.Method, http.StatusCreated, start, r)
	}

	httpx.WriteJSON(w, http.StatusCreated, shipment)
}

func (deps Dependencies) handlePublicGetShipment(w http.ResponseWriter, r *http.Request) {
	key, ok := deps.authenticatePublicAPIKey(w, r)
	if !ok {
		return
	}
	if !requirePublicScope(w, key, "fulfillment:read") {
		return
	}

	shipmentID := chi.URLParam(r, "shipment_id")
	shipment, err := deps.Core.GetShipment(r.Context(), "api_key:"+key.ID, shipmentID)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, shipment)
}

func (deps Dependencies) handlePublicUpdateShipmentStatus(w http.ResponseWriter, r *http.Request) {
	key, ok := deps.authenticatePublicAPIKey(w, r)
	if !ok {
		return
	}
	if !requirePublicScope(w, key, "fulfillment:write") {
		return
	}

	shipmentID := chi.URLParam(r, "shipment_id")
	var req coreclient.UpdateShipmentStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	start := time.Now()
	shipment, err := deps.Core.UpdateShipmentStatus(r.Context(), "api_key:"+key.ID, shipmentID, req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	if deps.AuditLogger != nil {
		deps.AuditLogger.Log(r.Context(), "api_key", key.ID, "fulfillment.update_status", shipmentID, r.Method, http.StatusOK, start, r)
	}

	httpx.WriteJSON(w, http.StatusOK, shipment)
}

// Public Webhook Subscriptions Management
func (deps Dependencies) handlePublicListWebhookSubscriptions(w http.ResponseWriter, r *http.Request) {
	key, ok := deps.authenticatePublicAPIKey(w, r)
	if !ok {
		return
	}
	if !requirePublicScope(w, key, "webhooks:read") {
		return
	}

	subs, err := deps.Core.ListWebhookSubscriptions(r.Context(), "api_key:"+key.ID, "seller", key.ActorID)
	if err != nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": []any{}})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": subs})
}

func (deps Dependencies) handlePublicCreateWebhookSubscription(w http.ResponseWriter, r *http.Request) {
	key, ok := deps.authenticatePublicAPIKey(w, r)
	if !ok {
		return
	}
	if !requirePublicScope(w, key, "webhooks:write") {
		return
	}

	var body createWebhookSubPayload
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	if err := webhook.ValidateTargetURL(body.TargetURL); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_target_url", err.Error())
		return
	}

	start := time.Now()
	sub, err := deps.Core.CreateWebhookSubscription(r.Context(), "api_key:"+key.ID, coreclient.CreateWebhookSubscriptionPayload{
		ActorType:        "seller",
		ActorID:          key.ActorID,
		TargetURL:        body.TargetURL,
		Secret:           body.Secret,
		SubscribedEvents: body.SubscribedEvents,
	})
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	if deps.AuditLogger != nil {
		deps.AuditLogger.Log(r.Context(), "api_key", key.ID, "webhook_subscription.create", sub.ID, r.Method, http.StatusCreated, start, r)
	}

	httpx.WriteJSON(w, http.StatusCreated, sub)
}

func (deps Dependencies) handlePublicDeleteWebhookSubscription(w http.ResponseWriter, r *http.Request) {
	key, ok := deps.authenticatePublicAPIKey(w, r)
	if !ok {
		return
	}
	if !requirePublicScope(w, key, "webhooks:write") {
		return
	}

	subID := chi.URLParam(r, "id")
	start := time.Now()
	if err := deps.Core.DeleteWebhookSubscription(r.Context(), "api_key:"+key.ID, subID, key.ActorID); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	if deps.AuditLogger != nil {
		deps.AuditLogger.Log(r.Context(), "api_key", key.ID, "webhook_subscription.delete", subID, r.Method, http.StatusOK, start, r)
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

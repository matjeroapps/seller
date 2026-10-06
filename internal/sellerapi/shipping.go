package sellerapi

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"seller/internal/actorhttp"
	"seller/internal/coreclient"
	"seller/internal/httpx"
)

func (deps Dependencies) handleCreateShipment(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	orderID := chi.URLParam(r, "order_id")

	var req coreclient.CreateShipmentRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}

	shipment, err := deps.Core.CreateOrderShipment(r.Context(), subject, orderID, req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, shipment)
}

func (deps Dependencies) handleGetShipment(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	shipmentID := chi.URLParam(r, "shipment_id")

	shipment, err := deps.Core.GetShipment(r.Context(), subject, shipmentID)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, shipment)
}

func (deps Dependencies) handleUpdateShipmentStatus(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	shipmentID := chi.URLParam(r, "shipment_id")

	var req coreclient.UpdateShipmentStatusRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}

	shipment, err := deps.Core.UpdateShipmentStatus(r.Context(), subject, shipmentID, req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, shipment)
}

func (deps Dependencies) handleListOrderShipments(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	orderID := chi.URLParam(r, "order_id")

	shipments, err := deps.Core.ListOrderShipments(r.Context(), subject, orderID)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"shipments": shipments})
}

type CreateStoreShipmentRequest struct {
	OrderID               string                            `json:"order_id"`
	FulfillmentLocationID string                            `json:"fulfillment_location_id"`
	CarrierName           string                            `json:"carrier_name,omitempty"`
	TrackingNumber        string                            `json:"tracking_number,omitempty"`
	ShippingCostMinor     int64                             `json:"shipping_cost_minor"`
	CodAmountMinor        int64                             `json:"cod_amount_minor"`
	Currency              string                            `json:"currency"`
	Items                 []coreclient.CreateShipmentItemRequest `json:"items"`
}

func (deps Dependencies) handleListStoreShipments(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	status := r.URL.Query().Get("status")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageSize < 1 {
		pageSize, _ = strconv.Atoi(r.URL.Query().Get("limit"))
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	res, err := deps.Core.ListStoreShipments(r.Context(), subject, storeID, status, page, pageSize)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res)
}

func (deps Dependencies) handleCreateStoreShipment(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}

	var req CreateStoreShipmentRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}

	if req.OrderID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "order_id is required")
		return
	}

	coreReq := coreclient.CreateShipmentRequest{
		FulfillmentLocationID: req.FulfillmentLocationID,
		CarrierName:           req.CarrierName,
		TrackingNumber:        req.TrackingNumber,
		ShippingCostMinor:     req.ShippingCostMinor,
		CodAmountMinor:        req.CodAmountMinor,
		Currency:              req.Currency,
		Items:                 req.Items,
	}

	shipment, err := deps.Core.CreateOrderShipment(r.Context(), subject, req.OrderID, coreReq)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, shipment)
}

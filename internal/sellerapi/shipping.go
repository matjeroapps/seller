package sellerapi

import (
	"net/http"

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

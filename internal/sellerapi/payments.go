package sellerapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/matjeroapps/seller/internal/actorhttp"
	"github.com/matjeroapps/seller/internal/coreclient"
	"github.com/matjeroapps/seller/internal/httpx"
)

func (deps Dependencies) handleInitializePayment(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	orderID := chi.URLParam(r, "order_id")

	var req coreclient.InitializePaymentRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}

	payment, err := deps.Core.InitializeOrderPayment(r.Context(), subject, orderID, req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, payment)
}

func (deps Dependencies) handleGetPayment(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	paymentID := chi.URLParam(r, "payment_id")

	payment, err := deps.Core.GetPayment(r.Context(), subject, paymentID)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, payment)
}

func (deps Dependencies) handleGetOrderPayment(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	orderID := chi.URLParam(r, "order_id")

	payment, err := deps.Core.GetOrderPayment(r.Context(), subject, orderID)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, payment)
}

func (deps Dependencies) handleUpdatePaymentStatus(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	paymentID := chi.URLParam(r, "payment_id")

	var req coreclient.UpdatePaymentStatusRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}

	payment, err := deps.Core.UpdatePaymentStatus(r.Context(), subject, paymentID, req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, payment)
}

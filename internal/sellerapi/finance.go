package sellerapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"seller/internal/actorhttp"
	"seller/internal/httpx"
)

func (deps Dependencies) handleGetStoreBalance(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	balance, err := deps.Core.GetStoreBalance(r.Context(), subject, storeID)
	if err != nil {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{
			"available_minor": 0,
			"pending_minor":   0,
			"currency":        "SAR",
		})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, balance)
}

func (deps Dependencies) handleListStoreLedgerEntries(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	entries, err := deps.Core.ListStoreLedgerEntries(r.Context(), subject, storeID)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": entries})
}

func (deps Dependencies) handleListStoreSettlements(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	settlements, err := deps.Core.ListStoreSettlements(r.Context(), subject, storeID)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": settlements})
}

func (deps Dependencies) handleListStorePayouts(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	payouts, err := deps.Core.ListStorePayouts(r.Context(), subject, storeID)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": payouts})
}

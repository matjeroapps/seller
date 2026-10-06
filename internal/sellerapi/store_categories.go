package sellerapi

// Store-scoped category handlers. The BFF is a typed passthrough: bodies are
// decoded into coreclient DTOs and forwarded to Core, which performs the
// authoritative store-membership authorization and returns not_found for any
// foreign or unknown id. Nothing here inspects or reshapes the category data.

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"seller/internal/actorhttp"
	"seller/internal/coreclient"
	"seller/internal/httpx"
)

func (deps Dependencies) handleListStoreCategories(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	status := r.URL.Query().Get("status")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	items, err := deps.Core.ListStoreCategories(r.Context(), subject, storeID, status, limit, offset)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	if items == nil {
		items = []coreclient.StoreCategory{}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"items":  items,
		"total":  len(items),
		"limit":  limit,
		"offset": offset,
	})
}

func (deps Dependencies) handleCreateStoreCategory(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	var input coreclient.StoreCategoryInput
	if !actorhttp.DecodeJSON(w, r, &input) {
		return
	}

	category, err := deps.Core.CreateStoreCategory(r.Context(), subject, storeID, input)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, category)
}

func (deps Dependencies) handleGetStoreCategory(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	categoryID := chi.URLParam(r, "category_id")

	category, err := deps.Core.GetStoreCategory(r.Context(), subject, storeID, categoryID)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, category)
}

func (deps Dependencies) handleUpdateStoreCategory(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	categoryID := chi.URLParam(r, "category_id")

	var input coreclient.StoreCategoryUpdateInput
	if !actorhttp.DecodeJSON(w, r, &input) {
		return
	}

	category, err := deps.Core.UpdateStoreCategory(r.Context(), subject, storeID, categoryID, input)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, category)
}

func (deps Dependencies) handleTransitionStoreCategoryStatus(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	categoryID := chi.URLParam(r, "category_id")

	var body struct {
		Status string `json:"status"`
	}
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}

	category, err := deps.Core.UpdateStoreCategoryStatus(r.Context(), subject, storeID, categoryID, body.Status)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, category)
}

func (deps Dependencies) handleDeleteStoreCategory(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	categoryID := chi.URLParam(r, "category_id")

	if err := deps.Core.DeleteStoreCategory(r.Context(), subject, storeID, categoryID); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (deps Dependencies) handleReorderStoreCategories(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	var body struct {
		Order []coreclient.StoreCategoryReorderEntry `json:"order"`
	}
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}

	if err := deps.Core.ReorderStoreCategories(r.Context(), subject, storeID, body.Order); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

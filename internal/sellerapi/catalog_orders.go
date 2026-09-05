package sellerapi

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/matjeroapps/seller/internal/actorhttp"
	"github.com/matjeroapps/seller/internal/coreclient"
	"github.com/matjeroapps/seller/internal/httpx"
)

// Handlers for Catalog, Inventory, Media, Presentation, Publish, and Order operations

func (deps Dependencies) handleListStoreProducts(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	status := r.URL.Query().Get("status")
	source := r.URL.Query().Get("source")
	query := r.URL.Query().Get("query")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	resp, err := deps.Core.ListStoreProducts(r.Context(), subject, storeID, status, source, query, limit, offset)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (deps Dependencies) handleCreateStoreProduct(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	var draft coreclient.SellerProductDraft
	if !actorhttp.DecodeJSON(w, r, &draft) {
		return
	}

	detail, err := deps.Core.CreateSellerProduct(r.Context(), subject, storeID, draft)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, detail)
}

func (deps Dependencies) handleGetStoreProductDetail(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")

	detail, err := deps.Core.GetSellerProductDetail(r.Context(), subject, storeID, productID)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, detail)
}

type updateProductRequest struct {
	Slug         string                                `json:"slug"`
	Translations []coreclient.SellerProductTranslation `json:"translations"`
	CategoryIDs  []string                              `json:"category_ids"`
}

func (deps Dependencies) handleUpdateStoreProduct(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")

	var body updateProductRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}

	detail, err := deps.Core.UpdateSellerProduct(r.Context(), subject, storeID, productID, body.Slug, body.Translations, body.CategoryIDs)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, detail)
}

type variantRequest struct {
	Code   string `json:"code"`
	Status string `json:"status"`
}

func (deps Dependencies) handleCreateVariant(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")

	var body variantRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}

	v, err := deps.Core.CreateVariant(r.Context(), subject, storeID, productID, body.Code, body.Status)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, v)
}

func (deps Dependencies) handleUpdateVariant(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")
	variantID := chi.URLParam(r, "variant_id")

	var body variantRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}

	v, err := deps.Core.UpdateVariant(r.Context(), subject, storeID, productID, variantID, body.Code, body.Status)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, v)
}

type skuRequest struct {
	Code    string  `json:"code"`
	Barcode *string `json:"barcode"`
	Status  string  `json:"status"`
}

func (deps Dependencies) handleCreateSKU(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")
	variantID := chi.URLParam(r, "variant_id")

	var body skuRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}

	sk, err := deps.Core.CreateSKU(r.Context(), subject, storeID, productID, variantID, body.Code, body.Barcode, body.Status)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, sk)
}

func (deps Dependencies) handleUpdateSKU(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")
	variantID := chi.URLParam(r, "variant_id")
	skuID := chi.URLParam(r, "sku_id")

	var body skuRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}

	sk, err := deps.Core.UpdateSKU(r.Context(), subject, storeID, productID, variantID, skuID, body.Code, body.Barcode, body.Status)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, sk)
}

func (deps Dependencies) handleCreateMediaUpload(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")

	var req coreclient.MediaUploadRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}

	resp, err := deps.Core.CreateMediaUpload(r.Context(), subject, storeID, productID, req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (deps Dependencies) handleCompleteMediaUpload(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")

	var req coreclient.CompleteMediaUploadRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}

	meta, err := deps.Core.CompleteMediaUpload(r.Context(), subject, storeID, productID, req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, meta)
}

type updateMediaRequest struct {
	AltText   string `json:"alt_text"`
	SortOrder int    `json:"sort_order"`
	IsPrimary bool   `json:"is_primary"`
}

func (deps Dependencies) handleUpdateMedia(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")
	mediaID := chi.URLParam(r, "media_id")

	var body updateMediaRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}

	meta, err := deps.Core.UpdateMedia(r.Context(), subject, storeID, productID, mediaID, body.AltText, body.SortOrder, body.IsPrimary)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, meta)
}

func (deps Dependencies) handleDeleteMedia(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")
	mediaID := chi.URLParam(r, "media_id")

	if err := deps.Core.DeleteMedia(r.Context(), subject, storeID, productID, mediaID); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (deps Dependencies) handleListStoreLocations(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	locs, err := deps.Core.ListStoreLocations(r.Context(), subject, storeID)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, locs)
}

type locationRequest struct {
	Code   string `json:"code"`
	Name   string `json:"name"`
	Type   string `json:"type"`
	Status string `json:"status"`
}

func (deps Dependencies) handleCreateStoreLocation(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	var body locationRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}

	loc, err := deps.Core.CreateStoreLocation(r.Context(), subject, storeID, body.Code, body.Name, body.Type, body.Status)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, loc)
}

func (deps Dependencies) handleListStoreInventory(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	inv, err := deps.Core.ListStoreInventory(r.Context(), subject, storeID)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, inv)
}

func (deps Dependencies) handleCreateInventorySnapshot(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	var req coreclient.CreateSnapshotRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}

	snap, err := deps.Core.CreateInventorySnapshot(r.Context(), subject, storeID, req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, snap)
}

func (deps Dependencies) handleAdjustInventory(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	snapshotID := chi.URLParam(r, "snapshot_id")

	var req coreclient.AdjustInventoryRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}

	snap, err := deps.Core.AdjustInventory(r.Context(), subject, storeID, snapshotID, req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, snap)
}

func (deps Dependencies) handleGetListingPresentation(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	listingID := chi.URLParam(r, "listing_id")

	pres, err := deps.Core.GetListingPresentation(r.Context(), subject, storeID, listingID)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, pres)
}

func (deps Dependencies) handleUpdateListingPresentation(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	listingID := chi.URLParam(r, "listing_id")

	var pres coreclient.SellerListingPresentation
	if !actorhttp.DecodeJSON(w, r, &pres) {
		return
	}

	updated, err := deps.Core.UpdateListingPresentation(r.Context(), subject, storeID, listingID, pres)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, updated)
}

func (deps Dependencies) handlePublishProduct(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")

	if err := deps.Core.PublishSellerProduct(r.Context(), subject, storeID, productID); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (deps Dependencies) handleUnpublishProduct(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")

	if err := deps.Core.UnpublishSellerProduct(r.Context(), subject, storeID, productID); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (deps Dependencies) handleListStoreOrders(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	status := r.URL.Query().Get("status")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	orders, err := deps.Core.ListStoreOrders(r.Context(), subject, storeID, status, limit, offset)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, orders)
}

func (deps Dependencies) handleGetStoreOrderDetail(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	orderID := chi.URLParam(r, "order_id")

	detail, err := deps.Core.GetStoreOrderDetail(r.Context(), subject, storeID, orderID)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, detail)
}

func (deps Dependencies) handleTransitionStoreOrder(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	orderID := chi.URLParam(r, "order_id")

	var req coreclient.OrderTransitionRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}

	detail, err := deps.Core.TransitionStoreOrder(r.Context(), subject, storeID, orderID, req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, detail)
}

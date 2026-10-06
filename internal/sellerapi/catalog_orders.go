package sellerapi

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"seller/internal/actorhttp"
	"seller/internal/auth"
	"seller/internal/coreclient"
	"seller/internal/httpx"
	"seller/internal/money"
)

const (
	roleOwner   = auth.RoleSellerOwner
	roleManager = auth.RoleSellerManager
	roleStaff   = auth.RoleSellerStaff
)

func requireRoles(w http.ResponseWriter, r *http.Request, roles ...string) bool {
	principal, ok := auth.PrincipalFrom(r.Context())
	if !ok || principal.Subject == "" {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "unauthorized")
		return false
	}
	if !principal.HasAnyRole(roles...) {
		httpx.WriteError(w, http.StatusForbidden, "forbidden", "operation requires higher privileges")
		return false
	}
	return true
}

func (deps Dependencies) handleUpdateStoreStatus(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	var body struct {
		Status string `json:"status"`
	}
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	store, err := deps.Core.UpdateStoreStatus(r.Context(), storeID, subject, body.Status)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, store)
}

func (deps Dependencies) handleGetStoreOperationalState(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	state, err := deps.Core.GetStoreOperationalState(r.Context(), chi.URLParam(r, "store_id"), subject)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, state)
}

func (deps Dependencies) handleUpdateStoreOperationalState(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	var body coreclient.StoreOperationalStateUpdate
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	state, err := deps.Core.UpdateStoreOperationalState(r.Context(), chi.URLParam(r, "store_id"), subject, body)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, state)
}

func (deps Dependencies) handleListStoreSupplierOffers(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	filter := coreclient.SupplierCatalogFilter{
		SupplierID: r.URL.Query().Get("supplier_id"),
		CategoryID: r.URL.Query().Get("category_id"),
		Query:      r.URL.Query().Get("query"),
		Page:       pageFrom(r),
	}
	items, err := deps.Core.ListStoreSupplierOffers(r.Context(), storeID, subject, filter)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleImportSupplierOffer(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	offerID := chi.URLParam(r, "offer_id")

	var params coreclient.SupplierOfferImportParams
	if r.Body != nil && r.ContentLength > 0 {
		_ = json.NewDecoder(r.Body).Decode(&params)
	}

	listing, err := deps.Core.ImportSupplierOffer(r.Context(), storeID, offerID, subject, params)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, listing)
}

func (deps Dependencies) handleListStoreListings(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	items, err := deps.Core.ListStoreListings(r.Context(), storeID, subject, pageFrom(r))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleGetStoreListing(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	listingID := chi.URLParam(r, "listing_id")

	listing, err := deps.Core.GetStoreListing(r.Context(), storeID, listingID, subject)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, listing)
}

func (deps Dependencies) handleGetStoreListingLifecycle(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	listingID := chi.URLParam(r, "listing_id")

	lifecycle, err := deps.Core.GetStoreListingLifecycle(r.Context(), storeID, listingID, subject)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, lifecycle)
}

func (deps Dependencies) handleSetStoreListingPrice(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	listingID := chi.URLParam(r, "listing_id")

	var body SellerListingPriceRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	priceMinor := body.AmountMinor
	if body.RetailPriceMinorUnits != nil {
		priceMinor = *body.RetailPriceMinorUnits
	}
	if priceMinor < 0 {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "retail price cannot be negative")
		return
	}
	if body.Currency != "" {
		if _, err := money.New(priceMinor, body.Currency); err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "validation_error", err.Error())
			return
		}
	}

	err := deps.Core.SetStoreListingPrice(r.Context(), storeID, listingID, subject, coreclient.PriceUpdate{
		AmountMinor:           priceMinor,
		Currency:              body.Currency,
		RetailPriceMinorUnits: &priceMinor,
		AllowSubWholesale:     body.AllowSubWholesale,
		AuditReason:           body.AuditReason,
	})
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (deps Dependencies) handleGetStoreListingReadiness(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	listingID := chi.URLParam(r, "listing_id")

	readiness, err := deps.Core.GetStoreListingReadiness(r.Context(), storeID, listingID, subject)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, readiness)
}

func (deps Dependencies) handlePublishStoreListing(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	listingID := chi.URLParam(r, "listing_id")

	listing, err := deps.Core.PublishStoreListing(r.Context(), storeID, listingID, subject)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, listing)
}

func (deps Dependencies) handleUnpublishStoreListing(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	listingID := chi.URLParam(r, "listing_id")

	listing, err := deps.Core.UnpublishStoreListing(r.Context(), storeID, listingID, subject)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, listing)
}

func (deps Dependencies) handleArchiveStoreListing(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	listingID := chi.URLParam(r, "listing_id")

	listing, err := deps.Core.ArchiveStoreListing(r.Context(), storeID, listingID, subject)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, listing)
}

func (deps Dependencies) handleTransitionProductStatus(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")

	var body struct {
		Status string `json:"status"`
	}
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	status, err := deps.Core.TransitionProductStatus(r.Context(), subject, storeID, productID, body.Status)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": status})
}

func (deps Dependencies) handleArchiveProduct(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")

	if err := deps.Core.ArchiveProduct(r.Context(), subject, storeID, productID); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "archived"})
}

func (deps Dependencies) handleListStoreMedia(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	filename := r.URL.Query().Get("filename")
	contentType := r.URL.Query().Get("content_type")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	res, err := deps.Core.ListStoreMedia(r.Context(), subject, storeID, filename, contentType, limit, offset)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (deps Dependencies) handlePresignStoreMediaUpload(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	var req coreclient.PresignMediaUploadRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}

	res, err := deps.Core.PresignStoreMediaUpload(r.Context(), subject, storeID, req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	status := http.StatusOK
	if res.Mode == "upload" {
		status = http.StatusCreated
	}
	httpx.WriteJSON(w, status, res)
}

func (deps Dependencies) handleCompleteStoreMediaUploadIntent(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	intentID := chi.URLParam(r, "intent_id")

	var req coreclient.CompleteStoreMediaUploadRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}

	asset, err := deps.Core.CompleteStoreMediaUploadIntent(r.Context(), subject, storeID, intentID, req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, asset)
}

func (deps Dependencies) handleDeleteStoreMediaAsset(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	assetID := chi.URLParam(r, "asset_id")

	if err := deps.Core.DeleteStoreMediaAsset(r.Context(), subject, storeID, assetID); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

func (deps Dependencies) handleListProductMediaReferences(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")

	refs, err := deps.Core.ListProductMediaReferences(r.Context(), subject, storeID, productID)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"references": refs})
}

func (deps Dependencies) handleAttachProductMediaReference(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")

	var req coreclient.AttachMediaReferenceRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}

	ref, err := deps.Core.AttachProductMediaReference(r.Context(), subject, storeID, productID, req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, ref)
}

func (deps Dependencies) handleUpdateProductMediaReference(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")
	referenceID := chi.URLParam(r, "reference_id")

	var req coreclient.UpdateMediaReferenceRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}

	ref, err := deps.Core.UpdateProductMediaReference(r.Context(), subject, storeID, productID, referenceID, req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ref)
}

func (deps Dependencies) handleDetachProductMediaReference(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")
	productID := chi.URLParam(r, "product_id")
	referenceID := chi.URLParam(r, "reference_id")

	if err := deps.Core.DetachProductMediaReference(r.Context(), subject, storeID, productID, referenceID); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

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
	Slug             string                                `json:"slug"`
	Translations     []coreclient.SellerProductTranslation `json:"translations"`
	CategoryIDs      []string                              `json:"category_ids"`
	StoreCategoryIDs []string                              `json:"store_category_ids"`
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

	detail, err := deps.Core.UpdateSellerProduct(r.Context(), subject, storeID, productID, body.Slug, body.Translations, body.CategoryIDs, body.StoreCategoryIDs)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, detail)
}

type variantRequest struct {
	Code            string                             `json:"code"`
	Status          string                             `json:"status"`
	SKUCode         *string                            `json:"sku_code,omitempty"`
	Barcode         *string                            `json:"barcode,omitempty"`
	AttributeValues []coreclient.AttributeValueMapping `json:"attribute_values,omitempty"`
	WeightGrams     *int                               `json:"weight_grams,omitempty"`
	Dimensions      *coreclient.VariantDimensionsDTO   `json:"dimensions,omitempty"`
	PriceMinorUnits *int64                             `json:"price_minor_units,omitempty"`
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

	if (body.SKUCode != nil && *body.SKUCode != "") || len(body.AttributeValues) > 0 || body.WeightGrams != nil || body.Dimensions != nil {
		v, err := deps.Core.CreateVariantWithOptions(r.Context(), subject, storeID, productID, coreclient.CreateVariantParams{
			Code:            body.Code,
			Status:          body.Status,
			SKUCode:         body.SKUCode,
			Barcode:         body.Barcode,
			AttributeValues: body.AttributeValues,
			WeightGrams:     body.WeightGrams,
			Dimensions:      body.Dimensions,
			PriceMinorUnits: body.PriceMinorUnits,
		})
		if err != nil {
			actorhttp.WriteCoreError(w, err)
			return
		}
		httpx.WriteJSON(w, http.StatusCreated, v)
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
	Code         string `json:"code"`
	Name         string `json:"name"`
	LocationType string `json:"location_type"`
	Status       string `json:"status"`
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

	loc, err := deps.Core.CreateStoreLocation(r.Context(), subject, storeID, body.Code, body.Name, body.LocationType, body.Status)
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

func (deps Dependencies) handleAdjustStoreInventoryDualMode(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := chi.URLParam(r, "store_id")

	var req coreclient.DualModeAdjustmentRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}

	idempotencyKey := r.Header.Get("Idempotency-Key")
	if idempotencyKey == "" {
		idempotencyKey = r.Header.Get("X-Idempotency-Key")
	}

	result, err := deps.Core.AdjustStoreInventoryDualMode(r.Context(), subject, storeID, req, idempotencyKey)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, result)
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
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
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
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
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
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
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

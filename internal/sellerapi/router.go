// Package sellerapi hosts the Seller Platform HTTP surface, including the theme
// endpoints that drive the native storefront.
//
// Every business capability is a Core-owned runtime call (ADR-017). This package
// owns request parsing, authorization of the authenticated principal, and the
// public response contract; it owns no business rules and no database access.
package sellerapi

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/seller/internal/actorhttp"
	"github.com/matjeroapps/seller/internal/coreclient"
	"github.com/matjeroapps/seller/internal/httpx"
	"github.com/matjeroapps/seller/internal/money"
)

// CoreCapabilities are the Core calls the seller routes depend on. The interface
// exists so handlers can be tested against a stub Core server.
type CoreCapabilities interface {
	ResolveSeller(ctx context.Context, subject string) (string, error)
	GetSeller(ctx context.Context, sellerID, subject string) (coreclient.Seller, map[string]any, error)
	UpdateSellerProfile(ctx context.Context, sellerID, subject string, update coreclient.ProfileUpdate) (string, error)
	ListSellerStores(ctx context.Context, sellerID, subject string, page coreclient.Page) ([]coreclient.Store, error)
	CreateSellerStore(ctx context.Context, sellerID, subject string, create coreclient.StoreCreate) (coreclient.Store, error)
	GetStore(ctx context.Context, storeID, subject string) (coreclient.Store, error)
	GetStorefrontHost(ctx context.Context, storeID, subject string) (string, error)
	ListSupplierCatalog(ctx context.Context, storeID, subject string, filter coreclient.SupplierCatalogFilter) ([]coreclient.SupplierCatalogItem, error)
	ListStoreListings(ctx context.Context, storeID, subject string, page coreclient.Page) ([]coreclient.SellerListing, error)
	ImportListing(ctx context.Context, storeID, subject string, importReq coreclient.ListingImport) (coreclient.SellerListing, error)
	SetListingPrice(ctx context.Context, listingID, subject string, price coreclient.PriceUpdate) error
	UpdateListingStatus(ctx context.Context, listingID, subject, status string) error
}

// Dependencies wires the seller routes.
type Dependencies struct {
	Core CoreCapabilities
}

func RegisterSellerRoutes(deps Dependencies) func(r chi.Router) {
	return func(r chi.Router) {
		r.Get("/seller/profile", deps.handleSellerProfile)
		r.Put("/seller/profile", deps.handleSellerProfileUpdate)
		r.Get("/seller/stores", deps.handleSellerStores)
		r.Post("/seller/stores", deps.handleSellerStoreCreate)
		r.Get("/seller/stores/{store_id}/storefront-host", deps.handleGetStorefrontHost)
		r.Get("/seller/catalog/offers", deps.handleSellerCatalogOffers)
		r.Get("/seller/listings", deps.handleSellerListings)
		r.Post("/seller/listings/import", deps.handleSellerListingImport)
		r.Post("/seller/listings/{id}/price", deps.handleSellerListingPrice)
		r.Post("/seller/listings/{id}/status", deps.handleSellerListingStatus)
	}
}

// sellerID resolves the caller's seller identity through Core. Core performs the
// resolution from the authenticated subject, so a caller cannot assert its own
// seller identifier.
func (deps Dependencies) sellerID(w http.ResponseWriter, r *http.Request) (string, string, bool) {
	subject, err := actorhttp.SubjectFrom(r)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return "", "", false
	}
	sellerID, err := deps.Core.ResolveSeller(r.Context(), subject)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return "", "", false
	}
	return subject, sellerID, true
}

func (deps Dependencies) handleSellerProfile(w http.ResponseWriter, r *http.Request) {
	_, sellerID, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	seller, settings, err := deps.Core.GetSeller(r.Context(), sellerID, actorhttp.SubjectOrEmpty(r))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, SellerProfileResponse{Seller: seller, Settings: settings})
}

func (deps Dependencies) handleSellerProfileUpdate(w http.ResponseWriter, r *http.Request) {
	subject, sellerID, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	var body SellerProfileUpdateRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	status, err := deps.Core.UpdateSellerProfile(r.Context(), sellerID, subject, coreclient.ProfileUpdate{
		Name:     body.Name,
		Status:   body.Status,
		Settings: body.Settings,
	})
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": status})
}

func (deps Dependencies) handleSellerStores(w http.ResponseWriter, r *http.Request) {
	subject, sellerID, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	items, err := deps.Core.ListSellerStores(r.Context(), sellerID, subject, pageFrom(r))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleSellerStoreCreate(w http.ResponseWriter, r *http.Request) {
	subject, sellerID, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	var body SellerStoreCreateRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	store, err := deps.Core.CreateSellerStore(r.Context(), sellerID, subject, coreclient.StoreCreate{
		MarketCode: body.MarketCode,
		Code:       body.Code,
		Name:       body.Name,
		Status:     body.Status,
		Settings:   body.Settings,
	})
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, store)
}

// handleSellerCatalogOffers browses the supplier offers available to one of the
// seller's stores. The store is loaded through Core, which enforces ownership, so
// a seller cannot browse another seller's store by guessing an identifier.
func (deps Dependencies) handleSellerCatalogOffers(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := r.URL.Query().Get("store_id")
	if _, err := deps.Core.GetStore(r.Context(), storeID, subject); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	filter := coreclient.SupplierCatalogFilter{
		SupplierID: r.URL.Query().Get("supplier_id"),
		CategoryID: r.URL.Query().Get("category_id"),
		Page:       pageFrom(r),
	}
	items, err := deps.Core.ListSupplierCatalog(r.Context(), storeID, subject, filter)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleSellerListings(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	storeID := r.URL.Query().Get("store_id")
	if _, err := deps.Core.GetStore(r.Context(), storeID, subject); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	items, err := deps.Core.ListStoreListings(r.Context(), storeID, subject, pageFrom(r))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleSellerListingImport(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	var body SellerListingImportRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	// The store is authorized through Core before the import is attempted.
	if _, err := deps.Core.GetStore(r.Context(), body.StoreID, subject); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	listing, err := deps.Core.ImportListing(r.Context(), body.StoreID, subject, coreclient.ListingImport{
		ProductID:       body.ProductID,
		SupplierOfferID: body.SupplierOfferID,
		Status:          body.Status,
		MarketCode:      body.MarketCode,
	})
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, listing)
}

func (deps Dependencies) handleSellerListingPrice(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	var body SellerListingPriceRequest
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	// Validate the money shape locally so a malformed currency is a 400 rather
	// than a round trip to Core.
	if _, err := money.New(body.AmountMinor, body.Currency); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	err := deps.Core.SetListingPrice(r.Context(), chi.URLParam(r, "id"), subject, coreclient.PriceUpdate{
		AmountMinor: body.AmountMinor,
		Currency:    body.Currency,
	})
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (deps Dependencies) handleSellerListingStatus(w http.ResponseWriter, r *http.Request) {
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	if err := deps.Core.UpdateListingStatus(r.Context(), chi.URLParam(r, "id"), subject, body.Status); err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": body.Status})
}

func (deps Dependencies) handleGetStorefrontHost(w http.ResponseWriter, r *http.Request) {
	subject, err := actorhttp.SubjectFrom(r)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	storeID := chi.URLParam(r, "store_id")
	host, err := deps.Core.GetStorefrontHost(r.Context(), storeID, subject)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, StorefrontHostResponse{Host: host})
}

// pageFrom converts the shared pagination window into the Core client's shape.
func pageFrom(r *http.Request) coreclient.Page {
	page := actorhttp.ParsePage(r)
	return coreclient.Page{Limit: page.Limit, Offset: page.Offset}
}

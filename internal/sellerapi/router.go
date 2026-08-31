// Package sellerapi hosts the Seller Platform HTTP surface, including the theme
// endpoints that drive the native storefront.
//
// Extracted verbatim from the monorepo's internal/platformapi package: only the
// seller routes and handlers live here. Shared helpers now come from
// matjero-core's pkg/actorhttp.
package sellerapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/matjeroapps/core/packages/httpx"
	"github.com/matjeroapps/core/packages/i18n"
	"github.com/matjeroapps/core/packages/money"
	"github.com/matjeroapps/core/pkg/actorhttp"
	"github.com/matjeroapps/core/pkg/commerce"
)

type Dependencies struct {
	Commerce commerce.Service
	Repo     commerce.Repository
}

func RegisterSellerRoutes(deps Dependencies) func(r chi.Router) {
	return func(r chi.Router) {
		r.Get("/seller/profile", deps.handleSellerProfile)
		r.Put("/seller/profile", deps.handleSellerProfileUpdate)
		r.Get("/seller/stores", deps.handleSellerStores)
		r.Post("/seller/stores", deps.handleSellerStoreCreate)
		r.Get("/seller/catalog/offers", deps.handleSellerCatalogOffers)
		r.Get("/seller/listings", deps.handleSellerListings)
		r.Post("/seller/listings/import", deps.handleSellerListingImport)
		r.Post("/seller/listings/{id}/price", deps.handleSellerListingPrice)
		r.Post("/seller/listings/{id}/status", deps.handleSellerListingStatus)
	}
}

func (deps Dependencies) handleSellerProfile(w http.ResponseWriter, r *http.Request) {
	subject, err := actorhttp.SubjectFrom(r)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	sellerID, err := actorhttp.ResolveSellerID(r.Context(), deps.Commerce, subject)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	seller, err := deps.Repo.GetSellerByID(r.Context(), sellerID)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	settings, _ := deps.Repo.GetSellerSettings(r.Context(), sellerID)
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"seller": seller, "settings": settings})
}

func (deps Dependencies) handleSellerProfileUpdate(w http.ResponseWriter, r *http.Request) {
	subject, err := actorhttp.SubjectFrom(r)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	sellerID, err := actorhttp.ResolveSellerID(r.Context(), deps.Commerce, subject)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	var body struct {
		Name     string         `json:"name"`
		Status   string         `json:"status"`
		Settings map[string]any `json:"settings"`
	}
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	if err := deps.Repo.UpdateSellerProfile(r.Context(), sellerID, body.Name, body.Status, body.Settings); err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": body.Status})
}

func (deps Dependencies) handleSellerStores(w http.ResponseWriter, r *http.Request) {
	subject, err := actorhttp.SubjectFrom(r)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	sellerID, err := actorhttp.ResolveSellerID(r.Context(), deps.Commerce, subject)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	items, err := deps.Repo.ListStores(r.Context(), commerce.Page(actorhttp.ParsePage(r)))
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	filtered := items[:0]
	for _, item := range items {
		if item.SellerID == sellerID {
			filtered = append(filtered, item)
		}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": filtered})
}

func (deps Dependencies) handleSellerStoreCreate(w http.ResponseWriter, r *http.Request) {
	subject, err := actorhttp.SubjectFrom(r)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	sellerID, err := actorhttp.ResolveSellerID(r.Context(), deps.Commerce, subject)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	var body struct {
		MarketCode string         `json:"market_code"`
		Code       string         `json:"code"`
		Name       string         `json:"name"`
		Status     string         `json:"status"`
		Settings   map[string]any `json:"settings"`
	}
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	store, err := deps.Commerce.CreateStoreForSubject(r.Context(), subject, sellerID, body.MarketCode, body.Code, body.Name, body.Status, body.Settings)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, store)
}

func (deps Dependencies) handleSellerCatalogOffers(w http.ResponseWriter, r *http.Request) {
	subject, err := actorhttp.SubjectFrom(r)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	sellerID, err := actorhttp.ResolveSellerID(r.Context(), deps.Commerce, subject)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	storeID := r.URL.Query().Get("store_id")
	store, err := deps.Repo.GetStore(r.Context(), storeID)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	if store.SellerID != sellerID {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	filter := commerce.SupplierCatalogFilter{
		MarketCode: store.MarketCode,
		Locale:     string(i18n.FromContext(r.Context())),
		Page:       commerce.Page(actorhttp.ParsePage(r)),
	}
	if supplier := r.URL.Query().Get("supplier_id"); supplier != "" {
		filter.SupplierID = supplier
	}
	if category := r.URL.Query().Get("category_id"); category != "" {
		filter.CategoryID = category
	}
	items, err := deps.Repo.ListSupplierCatalog(r.Context(), filter)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleSellerListings(w http.ResponseWriter, r *http.Request) {
	subject, err := actorhttp.SubjectFrom(r)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	sellerID, err := actorhttp.ResolveSellerID(r.Context(), deps.Commerce, subject)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	storeID := r.URL.Query().Get("store_id")
	store, err := deps.Repo.GetStore(r.Context(), storeID)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	if store.SellerID != sellerID {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	items, err := deps.Repo.ListSellerListings(r.Context(), storeID, commerce.Page(actorhttp.ParsePage(r)))
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (deps Dependencies) handleSellerListingImport(w http.ResponseWriter, r *http.Request) {
	subject, err := actorhttp.SubjectFrom(r)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	sellerID, err := actorhttp.ResolveSellerID(r.Context(), deps.Commerce, subject)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	var body struct {
		StoreID         string  `json:"store_id"`
		ProductID       string  `json:"product_id"`
		SupplierOfferID *string `json:"supplier_offer_id"`
		Status          string  `json:"status"`
		MarketCode      string  `json:"market_code"`
	}
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	store, err := deps.Repo.GetStore(r.Context(), body.StoreID)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	if store.SellerID != sellerID {
		httpx.WriteError(w, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	listing, err := deps.Commerce.CreateSellerListingForSubject(r.Context(), subject, body.StoreID, body.ProductID, body.SupplierOfferID, body.MarketCode, body.Status)
	if err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, listing)
}

func (deps Dependencies) handleSellerListingPrice(w http.ResponseWriter, r *http.Request) {
	var body struct {
		AmountMinor int64  `json:"amount_minor"`
		Currency    string `json:"currency"`
	}
	if !actorhttp.DecodeJSON(w, r, &body) {
		return
	}
	price, err := money.New(body.AmountMinor, body.Currency)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}
	if _, err := deps.Repo.SetSellerListingPrice(r.Context(), chi.URLParam(r, "id"), price); err != nil {
		actorhttp.WriteCommerceError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (deps Dependencies) handleSellerListingStatus(w http.ResponseWriter, r *http.Request) {
	actorhttp.UpdateStatusHandler(w, r, deps.Repo.UpdateSellerListingStatus)
}

package sellerapi

// Merchant-authorized Supply read pass-throughs (Feature 025). The browser
// reaches supply state only through the Seller API; these handlers forward the
// verified subject to Core's merchant-authorized supply read surfaces with the
// Seller service identity and never expose Core service credentials. Core
// performs the authoritative merchant membership/capability/permission checks;
// this layer adds no authorization of its own and no direct database access.

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"seller/internal/actorhttp"
	"seller/internal/httpx"
)

func merchantSupplySubject(w http.ResponseWriter, r *http.Request) (string, bool) {
	subject, err := actorhttp.SubjectFrom(r)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return "", false
	}
	return subject, true
}

func listRange(r *http.Request) (int, int) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit <= 0 {
		limit = 20
	}
	return limit, offset
}

func (deps Dependencies) handleListMerchantSupplyConnections(w http.ResponseWriter, r *http.Request) {
	subject, ok := merchantSupplySubject(w, r)
	if !ok {
		return
	}
	merchantID := chi.URLParam(r, "merchant_id")
	conns, err := deps.Core.ListSupplyConnections(r.Context(), subject, merchantID, r.URL.Query().Get("connection_type"))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, conns)
}

func (deps Dependencies) handleGetMerchantSupplyConnection(w http.ResponseWriter, r *http.Request) {
	subject, ok := merchantSupplySubject(w, r)
	if !ok {
		return
	}
	conn, err := deps.Core.GetSupplyConnection(r.Context(), subject, chi.URLParam(r, "merchant_id"), chi.URLParam(r, "connection_id"))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, conn)
}

func (deps Dependencies) handleListMerchantSupplyImportBatches(w http.ResponseWriter, r *http.Request) {
	subject, ok := merchantSupplySubject(w, r)
	if !ok {
		return
	}
	limit, offset := listRange(r)
	batches, err := deps.Core.ListSupplyImportBatches(r.Context(), subject, chi.URLParam(r, "merchant_id"), r.URL.Query().Get("connection_id"), r.URL.Query().Get("status"), limit, offset)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, batches)
}

func (deps Dependencies) handleGetMerchantSupplyImportBatch(w http.ResponseWriter, r *http.Request) {
	subject, ok := merchantSupplySubject(w, r)
	if !ok {
		return
	}
	detail, err := deps.Core.GetSupplyImportBatch(r.Context(), subject, chi.URLParam(r, "merchant_id"), chi.URLParam(r, "batch_id"))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, detail)
}

func (deps Dependencies) handleListMerchantSupplyReviewCases(w http.ResponseWriter, r *http.Request) {
	subject, ok := merchantSupplySubject(w, r)
	if !ok {
		return
	}
	cases, err := deps.Core.ListSupplyReviewCases(r.Context(), subject, chi.URLParam(r, "merchant_id"), r.URL.Query().Get("connection_id"), r.URL.Query().Get("status"))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, cases)
}

func (deps Dependencies) handleGetMerchantSupplyReviewCase(w http.ResponseWriter, r *http.Request) {
	subject, ok := merchantSupplySubject(w, r)
	if !ok {
		return
	}
	c, err := deps.Core.GetSupplyReviewCase(r.Context(), subject, chi.URLParam(r, "merchant_id"), chi.URLParam(r, "case_id"))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, c)
}

func (deps Dependencies) handleListMerchantSupplyMappings(w http.ResponseWriter, r *http.Request) {
	subject, ok := merchantSupplySubject(w, r)
	if !ok {
		return
	}
	mappings, err := deps.Core.ListSupplyMappings(r.Context(), subject, chi.URLParam(r, "merchant_id"), r.URL.Query().Get("connection_id"))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, mappings)
}

func (deps Dependencies) handleGetMerchantSupplyMapping(w http.ResponseWriter, r *http.Request) {
	subject, ok := merchantSupplySubject(w, r)
	if !ok {
		return
	}
	mapping, err := deps.Core.GetSupplyMapping(r.Context(), subject, chi.URLParam(r, "merchant_id"), chi.URLParam(r, "mapping_id"))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, mapping)
}

func (deps Dependencies) handleListMerchantSupplyCursors(w http.ResponseWriter, r *http.Request) {
	subject, ok := merchantSupplySubject(w, r)
	if !ok {
		return
	}
	cursors, err := deps.Core.ListSupplyCursors(r.Context(), subject, chi.URLParam(r, "merchant_id"), r.URL.Query().Get("connection_id"))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, cursors)
}

func (deps Dependencies) handleListMerchantSupplyFulfillmentRequests(w http.ResponseWriter, r *http.Request) {
	subject, ok := merchantSupplySubject(w, r)
	if !ok {
		return
	}
	limit, offset := listRange(r)
	requests, err := deps.Core.ListSupplyFulfillmentRequests(r.Context(), subject, chi.URLParam(r, "merchant_id"), r.URL.Query().Get("connection_id"), r.URL.Query().Get("status"), limit, offset)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, requests)
}

func (deps Dependencies) handleGetMerchantSupplyFulfillmentRequest(w http.ResponseWriter, r *http.Request) {
	subject, ok := merchantSupplySubject(w, r)
	if !ok {
		return
	}
	detail, err := deps.Core.GetSupplyFulfillmentRequest(r.Context(), subject, chi.URLParam(r, "merchant_id"), chi.URLParam(r, "request_id"))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, detail)
}

// RegisterMerchantSupplyRoutes mounts the merchant-authorized supply read
// pass-throughs on the authenticated seller router.
func RegisterMerchantSupplyRoutes(deps Dependencies) func(r chi.Router) {
	return func(r chi.Router) {
		r.Route("/merchants/{merchant_id}/integrations", func(r chi.Router) {
			r.Get("/connections", deps.handleListMerchantSupplyConnections)
			r.Get("/connections/{connection_id}", deps.handleGetMerchantSupplyConnection)
			r.Route("/supply", func(r chi.Router) {
				r.Get("/import-batches", deps.handleListMerchantSupplyImportBatches)
				r.Get("/import-batches/{batch_id}", deps.handleGetMerchantSupplyImportBatch)
				r.Get("/review-cases", deps.handleListMerchantSupplyReviewCases)
				r.Get("/review-cases/{case_id}", deps.handleGetMerchantSupplyReviewCase)
				r.Get("/mappings", deps.handleListMerchantSupplyMappings)
				r.Get("/mappings/{mapping_id}", deps.handleGetMerchantSupplyMapping)
				r.Get("/cursors", deps.handleListMerchantSupplyCursors)
				r.Get("/fulfillment-requests", deps.handleListMerchantSupplyFulfillmentRequests)
				r.Get("/fulfillment-requests/{request_id}", deps.handleGetMerchantSupplyFulfillmentRequest)
			})
		})
	}
}

package main

// In-memory P5.8 seller catalog state and handlers. The JSON shapes returned
// here mirror the recorded Core contract fixtures in
// internal/coreclient/testdata/p58/*.json exactly; coreclient parses them and
// the seller dashboard drives them.

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	fakeSellerID  = "sel-a"
	fakeStoreID   = "store-a"
	fakeStoreHost = "store-a.localhost"
)

type sellerProduct struct {
	id            string
	slug          string
	status        string
	createdAt     time.Time
	updatedAt     time.Time
	translations  []map[string]any // {product_id, locale, name, description}
	categoryIDs   []string
	listingID     string
	listingStatus string
	priceAmount   int64
	priceCurrency string
	hasPrice      bool
	variants      []*sellerVariant
	media         []*sellerMediaRecord
	presentation  *sellerPresentation
}

type sellerVariant struct {
	id        string
	code      string
	status    string
	createdAt time.Time
	updatedAt time.Time
	skus      []*sellerSKURecord
}

type sellerSKURecord struct {
	id        string
	code      string
	barcode   *string
	status    string
	createdAt time.Time
	updatedAt time.Time
}

type sellerMediaRecord struct {
	id         string
	productID  string
	mediaType  string
	uri        string
	storageKey string
	altText    string
	sortOrder  int
	isPrimary  bool
	createdAt  time.Time
	updatedAt  time.Time
}

type sellerPresentation struct {
	schemaVersion    int
	purchaseBehavior string
	sections         []any
	createdAt        time.Time
	updatedAt        time.Time
}

type sellerLocation struct {
	id        string
	code      string
	name      string
	locType   string
	status    string
	createdAt time.Time
	updatedAt time.Time
}

type sellerInventorySnapshot struct {
	id         string
	locationID string
	skuID      string
	onHand     int64
	reserved   int64
	version    int64
	createdAt  time.Time
	updatedAt  time.Time
}

type mediaIntent struct {
	token            string
	storageKey       string
	contentType      string
	filename         string
	maxBytes         int64
	completedMediaID string
}

// --- helpers ---

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeCoreError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]any{"code": code, "message": message},
	})
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func extensionFor(filename, contentType string) string {
	if i := strings.LastIndexByte(filename, '.'); i >= 0 && i < len(filename)-1 {
		return strings.ToLower(filename[i:])
	}
	switch contentType {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	default:
		return ".bin"
	}
}

// --- routing ---

// handleSellerAPI serves every non-storefront /internal/v1 route: the seller
// resolution, catalog, media, inventory, presentation, publish, and order
// endpoints the Seller service calls (ADR-017 internal contract).
func (s *fakeCoreServer) handleSellerAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	rest := strings.TrimPrefix(r.URL.Path, "/internal/v1/")
	parts := strings.Split(rest, "/")

	// Every seller capability is scoped to the subject Core resolves.
	subject := strings.TrimSpace(r.Header.Get("X-Matjero-Subject"))
	if subject != s.sellerSubject {
		writeCoreError(w, http.StatusForbidden, "forbidden", "subject does not map to a seller")
		return
	}

	switch {
	case parts[0] == "categories" && r.Method == http.MethodGet:
		s.handleListCategories(w)
	case parts[0] == "listings" && len(parts) == 3 && r.Method == http.MethodPost && parts[2] == "price":
		s.handleSetListingPrice(w, r, parts[1])
	case parts[0] == "listings" && len(parts) == 3 && r.Method == http.MethodPost && parts[2] == "status":
		s.handleSetListingStatus(w, r, parts[1])
	case parts[0] == "sellers":
		s.handleSellerRoutes(w, r, parts)
	case parts[0] == "stores" && len(parts) >= 2:
		s.handleStoreRoutes(w, r, parts)
	default:
		writeCoreError(w, http.StatusNotFound, "not_found", "endpoint not found")
	}
}

func (s *fakeCoreServer) handleSellerRoutes(w http.ResponseWriter, r *http.Request, parts []string) {
	switch {
	case len(parts) == 2 && parts[1] == "resolve" && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]any{"seller_id": fakeSellerID})

	case len(parts) == 2 && parts[1] == fakeSellerID && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]any{
			"seller":   s.sellerProfile(),
			"settings": map[string]any{},
		})

	case len(parts) == 3 && parts[1] == fakeSellerID && parts[2] == "profile" && r.Method == http.MethodPut:
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})

	case len(parts) == 3 && parts[1] == fakeSellerID && parts[2] == "stores" && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]any{"items": []any{s.sellerStore()}})

	case len(parts) == 3 && parts[1] == fakeSellerID && parts[2] == "stores" && r.Method == http.MethodPost:
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		code, _ := body["code"].(string)
		name, _ := body["name"].(string)
		market, _ := body["market_code"].(string)
		if code == "" || name == "" {
			writeCoreError(w, http.StatusUnprocessableEntity, "validation_error", "code and name are required")
			return
		}
		if market == "" {
			market = "EG"
		}
		now := time.Now().UTC()
		writeJSON(w, http.StatusCreated, map[string]any{
			"id":          "store-" + code,
			"seller_id":   fakeSellerID,
			"market_code": market,
			"code":        code,
			"name":        name,
			"status":      "active",
			"created_at":  now,
			"updated_at":  now,
		})

	default:
		writeCoreError(w, http.StatusNotFound, "not_found", "endpoint not found")
	}
}

func (s *fakeCoreServer) handleStoreRoutes(w http.ResponseWriter, r *http.Request, parts []string) {
	storeID := parts[1]
	if storeID != fakeStoreID {
		writeCoreError(w, http.StatusNotFound, "not_found", "store not found")
		return
	}

	sub := parts[2:]
	isProducts := len(sub) >= 1 && sub[0] == "products"
	isListings := len(sub) >= 1 && sub[0] == "listings"
	isInventory := len(sub) >= 1 && sub[0] == "inventory"
	isOrders := len(sub) >= 1 && sub[0] == "orders"

	switch {
	case len(sub) == 0 && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, s.sellerStore())

	case len(sub) == 1 && sub[0] == "storefront-host" && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]any{"host": fakeStoreHost})

	case len(sub) == 1 && sub[0] == "domains" && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]any{"items": s.seedDomains()})

	case len(sub) == 1 && sub[0] == "domains" && r.Method == http.MethodPost:
		writeCoreError(w, http.StatusUnprocessableEntity, "validation_error", "custom domains are not supported by fake-core")

	case len(sub) == 1 && sub[0] == "supplier-catalog" && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]any{"items": []any{}})

	case len(sub) == 1 && sub[0] == "listings" && r.Method == http.MethodGet:
		s.mu.RLock()
		items := []any{}
		for _, p := range s.sellerProducts {
			items = append(items, s.listingFor(p))
		}
		s.mu.RUnlock()
		writeJSON(w, http.StatusOK, map[string]any{"items": items})

	case len(sub) == 1 && sub[0] == "listings" && r.Method == http.MethodPost:
		writeCoreError(w, http.StatusUnprocessableEntity, "validation_error", "supplier listing import is not supported by fake-core")

	case len(sub) == 1 && sub[0] == "locations" && r.Method == http.MethodGet:
		s.handleListLocations(w)

	case len(sub) == 1 && sub[0] == "locations" && r.Method == http.MethodPost:
		s.handleCreateLocation(w, r)

	case len(sub) == 1 && sub[0] == "inventory" && r.Method == http.MethodGet:
		s.handleListInventory(w)

	case isInventory && len(sub) == 2 && sub[1] == "snapshots" && r.Method == http.MethodPost:
		s.handleCreateSnapshot(w, r)

	case isInventory && len(sub) == 3 && sub[2] == "adjustments" && r.Method == http.MethodPost:
		s.handleAdjustInventory(w, r, sub[1])

	case isListings && len(sub) == 3 && sub[2] == "presentation" && r.Method == http.MethodGet:
		s.handleGetPresentation(w, r, sub[1])

	case isListings && len(sub) == 3 && sub[2] == "presentation" && r.Method == http.MethodPut:
		s.handleUpdatePresentation(w, r, sub[1])

	case isProducts && len(sub) == 1 && r.Method == http.MethodGet:
		s.handleListProducts(w, r)

	case isProducts && len(sub) == 1 && r.Method == http.MethodPost:
		s.handleCreateProduct(w, r)

	case isProducts && len(sub) == 3 && sub[2] == "publish" && r.Method == http.MethodPost:
		s.handlePublish(w, r, sub[1], true)

	case isProducts && len(sub) == 3 && sub[2] == "unpublish" && r.Method == http.MethodPost:
		s.handlePublish(w, r, sub[1], false)

	case isProducts && len(sub) == 2 && r.Method == http.MethodGet:
		s.handleGetProduct(w, r, sub[1])

	case isProducts && len(sub) == 2 && r.Method == http.MethodPut:
		s.handleUpdateProduct(w, r, sub[1])

	case isProducts && len(sub) == 3 && sub[2] == "variants" && r.Method == http.MethodPost:
		s.handleCreateVariant(w, r, sub[1])

	case isProducts && len(sub) == 3 && sub[2] == "variants" && r.Method == http.MethodPut:
		s.handleUpdateVariant(w, r, sub[1], sub[2])

	case isProducts && len(sub) == 5 && sub[2] == "variants" && sub[4] == "skus" && r.Method == http.MethodPost:
		s.handleCreateSKU(w, r, sub[1], sub[3])

	case isProducts && len(sub) == 6 && sub[2] == "variants" && sub[4] == "skus" && r.Method == http.MethodPut:
		s.handleUpdateSKU(w, r, sub[1], sub[3], sub[5])

	case isProducts && len(sub) == 4 && sub[2] == "media" && sub[3] == "uploads" && r.Method == http.MethodPost:
		s.handleCreateMediaUpload(w, r, sub[1])

	case isProducts && len(sub) == 3 && sub[2] == "media" && r.Method == http.MethodPost:
		s.handleCompleteMediaUpload(w, r, sub[1])

	case isProducts && len(sub) == 4 && sub[2] == "media" && r.Method == http.MethodPut:
		s.handleUpdateMedia(w, r, sub[1], sub[3])

	case isProducts && len(sub) == 4 && sub[2] == "media" && r.Method == http.MethodDelete:
		s.handleDeleteMedia(w, r, sub[1], sub[3])

	case isOrders && len(sub) == 1 && r.Method == http.MethodGet:
		s.handleListOrders(w, r)

	case isOrders && len(sub) == 2 && r.Method == http.MethodGet:
		s.handleGetOrder(w, sub[1])

	case isOrders && len(sub) == 3 && sub[2] == "transition" && r.Method == http.MethodPost:
		s.handleTransitionOrder(w, r, sub[1])

	default:
		writeCoreError(w, http.StatusNotFound, "not_found", "endpoint not found")
	}
}

// --- seed shapes ---

func (s *fakeCoreServer) sellerProfile() map[string]any {
	return map[string]any{
		"id":         fakeSellerID,
		"code":       "seller-a",
		"name":       "Store A Seller",
		"status":     "active",
		"created_at": time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		"updated_at": time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
	}
}

func (s *fakeCoreServer) sellerStore() map[string]any {
	return map[string]any{
		"id":          fakeStoreID,
		"seller_id":   fakeSellerID,
		"market_code": "EG",
		"code":        "store-a",
		"name":        "Store A",
		"status":      "active",
		"created_at":  time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		"updated_at":  time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
	}
}

func (s *fakeCoreServer) seedDomains() []any {
	return []any{map[string]any{
		"id":          "dom-1",
		"store_id":    fakeStoreID,
		"domain":      fakeStoreHost,
		"is_primary":  true,
		"status":      "active",
		"domain_type": "platform_subdomain",
		"created_at":  time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		"updated_at":  time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
	}}
}

// --- categories ---

func (s *fakeCoreServer) handleListCategories(w http.ResponseWriter) {
	writeJSON(w, http.StatusOK, map[string]any{"items": s.sellerCategories})
}

// --- product shapes ---

func (s *fakeCoreServer) findProduct(id string) *sellerProduct {
	for _, p := range s.sellerProducts {
		if p.id == id || p.slug == id {
			return p
		}
	}
	return nil
}

func (s *fakeCoreServer) findProductByListing(listingID string) *sellerProduct {
	for _, p := range s.sellerProducts {
		if p.listingID == listingID {
			return p
		}
	}
	return nil
}

func (s *fakeCoreServer) translationValue(p *sellerProduct, field string) string {
	var fallback string
	for _, t := range p.translations {
		v, _ := t[field].(string)
		if v == "" {
			continue
		}
		if locale, _ := t["locale"].(string); locale == "en" {
			return v
		}
		if fallback == "" {
			fallback = v
		}
	}
	return fallback
}

func (s *fakeCoreServer) productShape(p *sellerProduct) map[string]any {
	return map[string]any{
		"id":         p.id,
		"slug":       p.slug,
		"status":     p.status,
		"created_at": p.createdAt,
		"updated_at": p.updatedAt,
	}
}

func (s *fakeCoreServer) priceShape(p *sellerProduct) any {
	if !p.hasPrice {
		return nil
	}
	return map[string]any{"amount": p.priceAmount, "currency": p.priceCurrency}
}

func (s *fakeCoreServer) listingFor(p *sellerProduct) map[string]any {
	return map[string]any{
		"id":          p.listingID,
		"store_id":    fakeStoreID,
		"product_id":  p.id,
		"market_code": "EG",
		"status":      p.listingStatus,
		"created_at":  p.createdAt,
		"updated_at":  p.updatedAt,
	}
}

func (s *fakeCoreServer) variantShape(v *sellerVariant) map[string]any {
	return map[string]any{
		"id":         v.id,
		"code":       v.code,
		"status":     v.status,
		"created_at": v.createdAt,
		"updated_at": v.updatedAt,
	}
}

func (s *fakeCoreServer) skuShape(variantID string, sk *sellerSKURecord) map[string]any {
	shape := map[string]any{
		"id":         sk.id,
		"variant_id": variantID,
		"code":       sk.code,
		"status":     sk.status,
		"created_at": sk.createdAt,
		"updated_at": sk.updatedAt,
	}
	if sk.barcode != nil {
		shape["barcode"] = sk.barcode
	}
	return shape
}

func (s *fakeCoreServer) mediaShape(m *sellerMediaRecord) map[string]any {
	return map[string]any{
		"id":          m.id,
		"product_id":  m.productID,
		"media_type":  m.mediaType,
		"uri":         m.uri,
		"storage_key": m.storageKey,
		"alt_text":    m.altText,
		"sort_order":  m.sortOrder,
		"is_primary":  m.isPrimary,
		"created_at":  m.createdAt,
		"updated_at":  m.updatedAt,
	}
}

func (s *fakeCoreServer) handleListProducts(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	status := r.URL.Query().Get("status")
	source := r.URL.Query().Get("source")
	query := strings.ToLower(r.URL.Query().Get("query"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 25
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	products := []any{}
	for _, p := range s.sellerProducts {
		if status != "" && p.status != status {
			continue
		}
		if source != "" && source != "seller_owned" {
			continue
		}
		name := strings.ToLower(s.translationValue(p, "name"))
		if query != "" && !strings.Contains(name, query) && !strings.Contains(strings.ToLower(p.slug), query) {
			continue
		}
		products = append(products, map[string]any{
			"product":           s.productShape(p),
			"source":            "seller_owned",
			"name":              s.translationValue(p, "name"),
			"listing_id":        p.listingID,
			"listing_status":    p.listingStatus,
			"current_price":     s.priceShape(p),
			"inventory_summary": s.inventorySummaryFor(p),
			"publish_readiness": s.publishReadiness(p),
		})
	}
	total := len(products)
	if offset > len(products) {
		offset = len(products)
	}
	end := offset + limit
	if end > len(products) {
		end = len(products)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"products": products[offset:end],
		"total":    total,
		"limit":    limit,
		"offset":   offset,
	})
}

func (s *fakeCoreServer) handleCreateProduct(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Slug         string           `json:"slug"`
		Translations []map[string]any `json:"translations"`
		CategoryIDs  []string         `json:"category_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeCoreError(w, http.StatusBadRequest, "invalid_argument", "invalid JSON body")
		return
	}
	if body.Slug == "" || len(body.Translations) == 0 {
		writeCoreError(w, http.StatusUnprocessableEntity, "validation_error", "slug and translations are required")
		return
	}

	s.mu.Lock()
	if existing := s.findProduct(body.Slug); existing != nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusConflict, "conflict", "slug already in use")
		return
	}
	now := time.Now().UTC()
	p := &sellerProduct{
		id:            fmt.Sprintf("prod-%d", s.idSeq.Add(1)),
		slug:          body.Slug,
		status:        "inactive",
		createdAt:     now,
		updatedAt:     now,
		listingID:     fmt.Sprintf("listing-%d", s.idSeq.Add(1)),
		listingStatus: "inactive",
		categoryIDs:   []string{},
		translations:  []map[string]any{},
		presentation: &sellerPresentation{
			schemaVersion:    1,
			purchaseBehavior: "add_to_cart",
			sections:         []any{},
			createdAt:        now,
			updatedAt:        now,
		},
	}
	for _, t := range body.Translations {
		locale, _ := t["locale"].(string)
		name, _ := t["name"].(string)
		description, _ := t["description"].(string)
		if locale == "" || name == "" {
			continue
		}
		p.translations = append(p.translations, map[string]any{
			"product_id":  p.id,
			"locale":      locale,
			"name":        name,
			"description": description,
		})
	}
	if body.CategoryIDs != nil {
		p.categoryIDs = body.CategoryIDs
	}
	s.sellerProducts = append(s.sellerProducts, p)
	resp := s.productDetailLocked(p)
	s.mu.Unlock()

	writeJSON(w, http.StatusCreated, resp)
}

func (s *fakeCoreServer) handleGetProduct(w http.ResponseWriter, _ *http.Request, productID string) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p := s.findProduct(productID)
	if p == nil {
		writeCoreError(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	writeJSON(w, http.StatusOK, s.productDetailLocked(p))
}

func (s *fakeCoreServer) handleUpdateProduct(w http.ResponseWriter, r *http.Request, productID string) {
	var body struct {
		Slug         string           `json:"slug"`
		Translations []map[string]any `json:"translations"`
		CategoryIDs  []string         `json:"category_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeCoreError(w, http.StatusBadRequest, "invalid_argument", "invalid JSON body")
		return
	}

	s.mu.Lock()
	p := s.findProduct(productID)
	if p == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	if body.Slug != "" && body.Slug != p.slug {
		if existing := s.findProduct(body.Slug); existing != nil && existing != p {
			s.mu.Unlock()
			writeCoreError(w, http.StatusConflict, "conflict", "slug already in use")
			return
		}
		p.slug = body.Slug
	}
	if body.Translations != nil {
		p.translations = []map[string]any{}
		for _, t := range body.Translations {
			locale, _ := t["locale"].(string)
			name, _ := t["name"].(string)
			description, _ := t["description"].(string)
			p.translations = append(p.translations, map[string]any{
				"product_id":  p.id,
				"locale":      locale,
				"name":        name,
				"description": description,
			})
		}
	}
	if body.CategoryIDs != nil {
		p.categoryIDs = body.CategoryIDs
	}
	p.updatedAt = time.Now().UTC()
	resp := s.productDetailLocked(p)
	s.mu.Unlock()

	writeJSON(w, http.StatusOK, resp)
}

func (s *fakeCoreServer) productDetailLocked(p *sellerProduct) map[string]any {
	translations := []any{}
	for _, t := range p.translations {
		translations = append(translations, t)
	}
	variants := []any{}
	skus := []any{}
	for _, v := range p.variants {
		variants = append(variants, s.variantShape(v))
		for _, sk := range v.skus {
			skus = append(skus, s.skuShape(v.id, sk))
		}
	}
	media := []any{}
	for _, m := range p.media {
		media = append(media, s.mediaShape(m))
	}
	presentation := s.presentationShape(p)

	return map[string]any{
		"product":           s.productShape(p),
		"source":            "seller_owned",
		"translations":      translations,
		"category_ids":      p.categoryIDs,
		"variants":          variants,
		"skus":              skus,
		"media":             media,
		"listing":           s.listingFor(p),
		"current_price":     s.priceShape(p),
		"inventory_summary": s.inventorySummaryFor(p),
		"presentation":      presentation,
		"purchase_behavior": presentation["purchase_behavior"],
		"publish_readiness": s.publishReadiness(p),
	}
}

// --- variants & skus ---

func (s *fakeCoreServer) findVariant(p *sellerProduct, variantID string) *sellerVariant {
	for _, v := range p.variants {
		if v.id == variantID {
			return v
		}
	}
	return nil
}

// deactivateOtherSKUs enforces Core's rule: a variant may have at most one
// active SKU; creating or activating one deactivates the others.
func (s *fakeCoreServer) deactivateOtherSKUs(v *sellerVariant, keepID string) {
	for _, other := range v.skus {
		if other.id != keepID && other.status == "active" {
			other.status = "inactive"
			other.updatedAt = time.Now().UTC()
		}
	}
}

func (s *fakeCoreServer) handleCreateVariant(w http.ResponseWriter, r *http.Request, productID string) {
	var body struct {
		Code   string `json:"code"`
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeCoreError(w, http.StatusBadRequest, "invalid_argument", "invalid JSON body")
		return
	}
	if body.Code == "" {
		writeCoreError(w, http.StatusUnprocessableEntity, "validation_error", "variant code is required")
		return
	}
	if body.Status == "" {
		body.Status = "active"
	}

	s.mu.Lock()
	p := s.findProduct(productID)
	if p == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	now := time.Now().UTC()
	v := &sellerVariant{
		id:        fmt.Sprintf("var-%d", s.idSeq.Add(1)),
		code:      body.Code,
		status:    body.Status,
		createdAt: now,
		updatedAt: now,
	}
	p.variants = append(p.variants, v)
	p.updatedAt = now
	shape := s.variantShape(v)
	shape["product_id"] = p.id
	s.mu.Unlock()

	writeJSON(w, http.StatusCreated, shape)
}

func (s *fakeCoreServer) handleUpdateVariant(w http.ResponseWriter, r *http.Request, productID, variantID string) {
	var body struct {
		Code   string `json:"code"`
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeCoreError(w, http.StatusBadRequest, "invalid_argument", "invalid JSON body")
		return
	}

	s.mu.Lock()
	p := s.findProduct(productID)
	if p == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	v := s.findVariant(p, variantID)
	if v == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "variant not found")
		return
	}
	if body.Code != "" {
		v.code = body.Code
	}
	if body.Status != "" {
		v.status = body.Status
	}
	v.updatedAt = time.Now().UTC()
	p.updatedAt = v.updatedAt
	shape := s.variantShape(v)
	shape["product_id"] = p.id
	s.mu.Unlock()

	writeJSON(w, http.StatusOK, shape)
}

func (s *fakeCoreServer) handleCreateSKU(w http.ResponseWriter, r *http.Request, productID, variantID string) {
	var body struct {
		Code    string  `json:"code"`
		Barcode *string `json:"barcode"`
		Status  string  `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeCoreError(w, http.StatusBadRequest, "invalid_argument", "invalid JSON body")
		return
	}
	if body.Code == "" {
		writeCoreError(w, http.StatusUnprocessableEntity, "validation_error", "SKU code is required")
		return
	}
	if body.Status == "" {
		body.Status = "active"
	}

	s.mu.Lock()
	p := s.findProduct(productID)
	if p == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	v := s.findVariant(p, variantID)
	if v == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "variant not found")
		return
	}
	now := time.Now().UTC()
	sk := &sellerSKURecord{
		id:        fmt.Sprintf("sku-%d", s.idSeq.Add(1)),
		code:      body.Code,
		barcode:   body.Barcode,
		status:    body.Status,
		createdAt: now,
		updatedAt: now,
	}
	if sk.status == "active" {
		s.deactivateOtherSKUs(v, sk.id)
	}
	v.skus = append(v.skus, sk)
	p.updatedAt = now
	shape := s.skuShape(v.id, sk)
	s.mu.Unlock()

	writeJSON(w, http.StatusCreated, shape)
}

func (s *fakeCoreServer) handleUpdateSKU(w http.ResponseWriter, r *http.Request, productID, variantID, skuID string) {
	var body struct {
		Code    string  `json:"code"`
		Barcode *string `json:"barcode"`
		Status  string  `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeCoreError(w, http.StatusBadRequest, "invalid_argument", "invalid JSON body")
		return
	}

	s.mu.Lock()
	p := s.findProduct(productID)
	if p == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	v := s.findVariant(p, variantID)
	if v == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "variant not found")
		return
	}
	var sk *sellerSKURecord
	for _, candidate := range v.skus {
		if candidate.id == skuID {
			sk = candidate
			break
		}
	}
	if sk == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "SKU not found")
		return
	}
	if body.Code != "" {
		sk.code = body.Code
	}
	if body.Barcode != nil {
		sk.barcode = body.Barcode
	}
	if body.Status != "" {
		sk.status = body.Status
		if sk.status == "active" {
			s.deactivateOtherSKUs(v, sk.id)
		}
	}
	sk.updatedAt = time.Now().UTC()
	p.updatedAt = sk.updatedAt
	shape := s.skuShape(v.id, sk)
	s.mu.Unlock()

	writeJSON(w, http.StatusOK, shape)
}

// --- listing price & status ---

func (s *fakeCoreServer) handleSetListingPrice(w http.ResponseWriter, r *http.Request, listingID string) {
	var body struct {
		AmountMinor int64  `json:"amount_minor"`
		Currency    string `json:"currency"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeCoreError(w, http.StatusBadRequest, "invalid_argument", "invalid JSON body")
		return
	}
	if body.AmountMinor < 0 || body.Currency == "" {
		writeCoreError(w, http.StatusUnprocessableEntity, "validation_error", "amount_minor and currency are required")
		return
	}

	s.mu.Lock()
	p := s.findProductByListing(listingID)
	if p == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "listing not found")
		return
	}
	if body.Currency != "EGP" {
		s.mu.Unlock()
		writeCoreError(w, http.StatusUnprocessableEntity, "validation_error", "currency does not match the store market")
		return
	}
	p.priceAmount = body.AmountMinor
	p.priceCurrency = body.Currency
	p.hasPrice = true
	p.updatedAt = time.Now().UTC()
	s.mu.Unlock()

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *fakeCoreServer) handleSetListingStatus(w http.ResponseWriter, r *http.Request, listingID string) {
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeCoreError(w, http.StatusBadRequest, "invalid_argument", "invalid JSON body")
		return
	}

	s.mu.Lock()
	p := s.findProductByListing(listingID)
	if p == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "listing not found")
		return
	}
	p.listingStatus = body.Status
	p.status = body.Status
	p.updatedAt = time.Now().UTC()
	s.mu.Unlock()

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

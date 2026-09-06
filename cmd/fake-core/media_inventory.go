package main

// P5.8 media, locations, inventory, presentation, and publish handlers.
// The media flow performs a real MinIO round trip: presigned PUT against the
// configured S3 endpoint and a HeadObject verification on completion. When
// MinIO is unreachable these endpoints fail loudly rather than faking success.

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
)

// --- media ---

func (s *fakeCoreServer) handleCreateMediaUpload(w http.ResponseWriter, r *http.Request, productID string) {
	if s.s3 == nil {
		writeCoreError(w, http.StatusServiceUnavailable, "unavailable", "media storage is not configured (S3_ENDPOINT missing)")
		return
	}
	var body struct {
		Filename    string `json:"filename"`
		ContentType string `json:"content_type"`
		SizeBytes   int64  `json:"size_bytes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeCoreError(w, http.StatusBadRequest, "invalid_argument", "invalid JSON body")
		return
	}
	if body.Filename == "" || body.ContentType == "" {
		writeCoreError(w, http.StatusUnprocessableEntity, "validation_error", "filename and content_type are required")
		return
	}

	s.mu.RLock()
	p := s.findProduct(productID)
	if p == nil {
		s.mu.RUnlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	s.mu.RUnlock()

	storageKey := fmt.Sprintf("products/%s/%s/%s%s", fakeStoreID, p.id, randomHex(16), extensionFor(body.Filename, body.ContentType))
	token := randomHex(32)

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	uploadURL, err := s.s3.presignPut(ctx, storageKey, body.ContentType)
	if err != nil {
		writeCoreError(w, http.StatusServiceUnavailable, "unavailable", fmt.Sprintf("presign upload: %v", err))
		return
	}

	intent := &mediaIntent{
		token:       token,
		storageKey:  storageKey,
		contentType: body.ContentType,
		filename:    body.Filename,
		maxBytes:    s.s3.maxBytes,
	}
	s.mu.Lock()
	s.mediaIntents[token] = intent
	s.mu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"upload_url":   uploadURL,
		"storage_key":  storageKey,
		"upload_token": token,
		"expires_at":   time.Now().UTC().Add(s.s3.urlTTL),
	})
}

func (s *fakeCoreServer) handleCompleteMediaUpload(w http.ResponseWriter, r *http.Request, productID string) {
	if s.s3 == nil {
		writeCoreError(w, http.StatusServiceUnavailable, "unavailable", "media storage is not configured (S3_ENDPOINT missing)")
		return
	}
	var body struct {
		StorageKey  string `json:"storage_key"`
		UploadToken string `json:"upload_token"`
		AltText     string `json:"alt_text"`
		SortOrder   int    `json:"sort_order"`
		IsPrimary   bool   `json:"is_primary"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeCoreError(w, http.StatusBadRequest, "invalid_argument", "invalid JSON body")
		return
	}

	s.mu.Lock()
	intent, ok := s.mediaIntents[body.UploadToken]
	if !ok || intent.storageKey != body.StorageKey {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "upload intent not found")
		return
	}
	if intent.completedMediaID != "" {
		// Idempotent completion: return the media record created on the first call.
		p := s.findProduct(productID)
		if p != nil {
			for _, m := range p.media {
				if m.id == intent.completedMediaID {
					shape := s.mediaShape(m)
					s.mu.Unlock()
					writeJSON(w, http.StatusCreated, shape)
					return
				}
			}
		}
	}
	s.mu.Unlock()

	// Verify the object actually landed in MinIO, outside the state lock.
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	head, err := s.s3.head(ctx, body.StorageKey)
	if err != nil {
		writeCoreError(w, http.StatusUnprocessableEntity, "validation_error", fmt.Sprintf("uploaded object not found in storage: %v", err))
		return
	}
	verifiedType := strings.TrimSpace(aws.ToString(head.ContentType))
	if verifiedType != intent.contentType {
		writeCoreError(w, http.StatusUnprocessableEntity, "validation_error",
			fmt.Sprintf("content type mismatch: intent %q but object is %q", intent.contentType, verifiedType))
		return
	}
	size := int64(0)
	if head.ContentLength != nil {
		size = *head.ContentLength
	}
	if size <= 0 || size > intent.maxBytes {
		writeCoreError(w, http.StatusUnprocessableEntity, "validation_error",
			fmt.Sprintf("object size %d is outside the allowed range (0, %d]", size, intent.maxBytes))
		return
	}

	now := time.Now().UTC()
	media := &sellerMediaRecord{
		id:         fmt.Sprintf("med-%d", s.idSeq.Add(1)),
		mediaType:  verifiedType,
		uri:        s.s3.publicURI(body.StorageKey),
		storageKey: body.StorageKey,
		altText:    body.AltText,
		sortOrder:  body.SortOrder,
		isPrimary:  body.IsPrimary,
		createdAt:  now,
		updatedAt:  now,
	}

	s.mu.Lock()
	p := s.findProduct(productID)
	if p == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	if body.IsPrimary || len(p.media) == 0 {
		media.isPrimary = true
		for _, other := range p.media {
			other.isPrimary = false
			other.updatedAt = now
		}
	}
	media.productID = p.id
	p.media = append(p.media, media)
	p.updatedAt = now
	intent.completedMediaID = media.id
	shape := s.mediaShape(media)
	s.mu.Unlock()

	writeJSON(w, http.StatusCreated, shape)
}

func (s *fakeCoreServer) handleUpdateMedia(w http.ResponseWriter, r *http.Request, productID, mediaID string) {
	var body struct {
		AltText   string `json:"alt_text"`
		SortOrder int    `json:"sort_order"`
		IsPrimary bool   `json:"is_primary"`
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
	var media *sellerMediaRecord
	for _, m := range p.media {
		if m.id == mediaID {
			media = m
			break
		}
	}
	if media == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "media not found")
		return
	}
	now := time.Now().UTC()
	media.altText = body.AltText
	media.sortOrder = body.SortOrder
	if body.IsPrimary && !media.isPrimary {
		for _, other := range p.media {
			other.isPrimary = false
			other.updatedAt = now
		}
		media.isPrimary = true
	}
	media.updatedAt = now
	p.updatedAt = now
	shape := s.mediaShape(media)
	s.mu.Unlock()

	writeJSON(w, http.StatusOK, shape)
}

func (s *fakeCoreServer) handleDeleteMedia(w http.ResponseWriter, r *http.Request, productID, mediaID string) {
	s.mu.Lock()
	p := s.findProduct(productID)
	if p == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	var media *sellerMediaRecord
	remaining := p.media[:0]
	for _, m := range p.media {
		if m.id == mediaID {
			media = m
			continue
		}
		remaining = append(remaining, m)
	}
	if media == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "media not found")
		return
	}
	p.media = remaining
	wasPrimary := media.isPrimary
	if wasPrimary && len(p.media) > 0 {
		// Promote the earliest remaining media to primary.
		p.media[0].isPrimary = true
		p.media[0].updatedAt = time.Now().UTC()
	}
	p.updatedAt = time.Now().UTC()
	storageKey := media.storageKey
	s.mu.Unlock()

	if s.s3 != nil && storageKey != "" {
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		if err := s.s3.delete(ctx, storageKey); err != nil {
			writeCoreError(w, http.StatusServiceUnavailable, "unavailable", fmt.Sprintf("delete object: %v", err))
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- locations ---

func (s *fakeCoreServer) locationShape(l *sellerLocation) map[string]any {
	return map[string]any{
		"supplier_id":        "",
		"store_id":           fakeStoreID,
		"id":                 l.id,
		"supplier_market_id": "",
		"market_code":        "EG",
		"code":               l.code,
		"name":               l.name,
		"location_type":      l.locType,
		"status":             l.status,
		"created_at":         l.createdAt,
		"updated_at":         l.updatedAt,
	}
}

func (s *fakeCoreServer) handleListLocations(w http.ResponseWriter) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	locations := []any{}
	for _, l := range s.sellerLocations {
		locations = append(locations, s.locationShape(l))
	}
	writeJSON(w, http.StatusOK, map[string]any{"locations": locations})
}

func (s *fakeCoreServer) handleCreateLocation(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code         string `json:"code"`
		Name         string `json:"name"`
		LocationType string `json:"location_type"`
		Status       string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeCoreError(w, http.StatusBadRequest, "invalid_argument", "invalid JSON body")
		return
	}
	if body.Code == "" || body.Name == "" {
		writeCoreError(w, http.StatusUnprocessableEntity, "validation_error", "code and name are required")
		return
	}
	if body.LocationType == "" {
		body.LocationType = "warehouse"
	}
	if body.Status == "" {
		body.Status = "active"
	}

	s.mu.Lock()
	now := time.Now().UTC()
	l := &sellerLocation{
		id:        fmt.Sprintf("loc-%d", s.idSeq.Add(1)),
		code:      body.Code,
		name:      body.Name,
		locType:   body.LocationType,
		status:    body.Status,
		createdAt: now,
		updatedAt: now,
	}
	s.sellerLocations = append(s.sellerLocations, l)
	shape := s.locationShape(l)
	s.mu.Unlock()

	writeJSON(w, http.StatusCreated, shape)
}

// --- inventory ---

func (s *fakeCoreServer) snapshotShape(snap *sellerInventorySnapshot, locationName string) map[string]any {
	return map[string]any{
		"id":                      snap.id,
		"fulfillment_location_id": snap.locationID,
		"sku_id":                  snap.skuID,
		"on_hand_qty":             snap.onHand,
		"reserved_qty":            snap.reserved,
		"version":                 snap.version,
		"created_at":              snap.createdAt,
		"updated_at":              snap.updatedAt,
		"location_name":           locationName,
		"available_qty":           snap.onHand - snap.reserved,
	}
}

func (s *fakeCoreServer) locationName(id string) string {
	for _, l := range s.sellerLocations {
		if l.id == id {
			return l.name
		}
	}
	return ""
}

func (s *fakeCoreServer) handleListInventory(w http.ResponseWriter) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	inventory := []any{}
	for _, snap := range s.sellerInventory {
		inventory = append(inventory, s.snapshotShape(snap, s.locationName(snap.locationID)))
	}
	writeJSON(w, http.StatusOK, map[string]any{"inventory": inventory})
}

func (s *fakeCoreServer) findSKU(skuID string) (*sellerProduct, *sellerVariant, *sellerSKURecord) {
	for _, p := range s.sellerProducts {
		for _, v := range p.variants {
			for _, sk := range v.skus {
				if sk.id == skuID {
					return p, v, sk
				}
			}
		}
	}
	return nil, nil, nil
}

func (s *fakeCoreServer) handleCreateSnapshot(w http.ResponseWriter, r *http.Request) {
	var body struct {
		LocationID string `json:"location_id"`
		SKUID      string `json:"sku_id"`
		OnHandQty  int64  `json:"on_hand_qty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeCoreError(w, http.StatusBadRequest, "invalid_argument", "invalid JSON body")
		return
	}

	s.mu.Lock()
	var location *sellerLocation
	for _, l := range s.sellerLocations {
		if l.id == body.LocationID {
			location = l
			break
		}
	}
	if location == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusUnprocessableEntity, "validation_error", "unknown fulfillment location")
		return
	}
	if _, _, sk := s.findSKU(body.SKUID); sk == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusUnprocessableEntity, "validation_error", "unknown SKU")
		return
	}
	// Replace any existing snapshot for the same location+SKU pair (snapshot
	// semantics: the new on-hand quantity supersedes the old one).
	now := time.Now().UTC()
	var existing *sellerInventorySnapshot
	for _, snap := range s.sellerInventory {
		if snap.locationID == body.LocationID && snap.skuID == body.SKUID {
			existing = snap
			break
		}
	}
	if existing != nil {
		existing.onHand = body.OnHandQty
		existing.version++
		existing.updatedAt = now
		shape := s.snapshotShape(existing, location.name)
		s.mu.Unlock()
		writeJSON(w, http.StatusOK, shape)
		return
	}
	snap := &sellerInventorySnapshot{
		id:         fmt.Sprintf("snap-%d", s.idSeq.Add(1)),
		locationID: body.LocationID,
		skuID:      body.SKUID,
		onHand:     body.OnHandQty,
		createdAt:  now,
		updatedAt:  now,
	}
	s.sellerInventory = append(s.sellerInventory, snap)
	shape := s.snapshotShape(snap, location.name)
	s.mu.Unlock()

	writeJSON(w, http.StatusCreated, shape)
}

func (s *fakeCoreServer) handleAdjustInventory(w http.ResponseWriter, r *http.Request, snapshotID string) {
	var body struct {
		DeltaQuantity int64   `json:"quantity_delta"`
		Reason        *string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeCoreError(w, http.StatusBadRequest, "invalid_argument", "invalid JSON body")
		return
	}
	if body.DeltaQuantity == 0 {
		writeCoreError(w, http.StatusUnprocessableEntity, "validation_error", "quantity_delta must be non-zero")
		return
	}

	s.mu.Lock()
	var snap *sellerInventorySnapshot
	for _, candidate := range s.sellerInventory {
		if candidate.id == snapshotID {
			snap = candidate
			break
		}
	}
	if snap == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "inventory snapshot not found")
		return
	}
	snap.onHand += body.DeltaQuantity
	if snap.onHand < 0 {
		snap.onHand = 0
	}
	snap.version++
	snap.updatedAt = time.Now().UTC()
	shape := s.snapshotShape(snap, s.locationName(snap.locationID))
	s.mu.Unlock()

	writeJSON(w, http.StatusOK, shape)
}

// --- presentation ---

func (s *fakeCoreServer) presentationShape(p *sellerProduct) map[string]any {
	pres := p.presentation
	sections := pres.sections
	if sections == nil {
		sections = []any{}
	}
	return map[string]any{
		"seller_listing_id": p.listingID,
		"schema_version":    pres.schemaVersion,
		"purchase_behavior": pres.purchaseBehavior,
		"sections":          sections,
		"created_at":        pres.createdAt,
		"updated_at":        pres.updatedAt,
	}
}

func (s *fakeCoreServer) handleGetPresentation(w http.ResponseWriter, r *http.Request, listingID string) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p := s.findProductByListing(listingID)
	if p == nil {
		writeCoreError(w, http.StatusNotFound, "not_found", "listing not found")
		return
	}
	writeJSON(w, http.StatusOK, s.presentationShape(p))
}

func (s *fakeCoreServer) handleUpdatePresentation(w http.ResponseWriter, r *http.Request, listingID string) {
	var body struct {
		SchemaVersion    int    `json:"schema_version"`
		PurchaseBehavior string `json:"purchase_behavior"`
		Sections         []any  `json:"sections"`
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
	now := time.Now().UTC()
	sections := body.Sections
	if sections == nil {
		sections = []any{}
	}
	p.presentation = &sellerPresentation{
		schemaVersion:    body.SchemaVersion,
		purchaseBehavior: body.PurchaseBehavior,
		sections:         sections,
		createdAt:        p.presentation.createdAt,
		updatedAt:        now,
	}
	shape := s.presentationShape(p)
	s.mu.Unlock()

	writeJSON(w, http.StatusOK, shape)
}

// --- inventory summary & publish readiness ---

func (s *fakeCoreServer) inventorySummaryFor(p *sellerProduct) map[string]any {
	locations := []any{}
	var totalOnHand, totalReserved, totalAvailable int64
	for _, v := range p.variants {
		for _, sk := range v.skus {
			for _, snap := range s.sellerInventory {
				if snap.skuID != sk.id {
					continue
				}
				available := snap.onHand - snap.reserved
				totalOnHand += snap.onHand
				totalReserved += snap.reserved
				totalAvailable += available
				locations = append(locations, map[string]any{
					"location_id":   snap.locationID,
					"location_name": s.locationName(snap.locationID),
					"sku_id":        sk.id,
					"on_hand_qty":   snap.onHand,
					"reserved_qty":  snap.reserved,
					"available_qty": available,
				})
			}
		}
	}
	if locations == nil {
		locations = []any{}
	}
	return map[string]any{
		"total_on_hand":   totalOnHand,
		"total_reserved":  totalReserved,
		"total_available": totalAvailable,
		"locations":       locations,
	}
}

// publishReadiness computes Core's readiness gate: a name, exactly one active
// SKU on one active variant, a current price in the store currency, at least
// one media item, and sellable inventory at an active location.
func (s *fakeCoreServer) publishReadiness(p *sellerProduct) map[string]any {
	var reasons []string
	if s.translationValue(p, "name") == "" {
		reasons = append(reasons, "missing_product_name")
	}
	activeVariantWithSKU := false
	for _, v := range p.variants {
		if v.status != "active" {
			continue
		}
		activeSKUs := 0
		for _, sk := range v.skus {
			if sk.status == "active" {
				activeSKUs++
			}
		}
		if activeSKUs == 1 {
			activeVariantWithSKU = true
		}
	}
	if !activeVariantWithSKU {
		reasons = append(reasons, "missing_active_variant_with_single_active_sku")
	}
	if !p.hasPrice {
		reasons = append(reasons, "missing_price")
	} else if p.priceCurrency != "EGP" {
		reasons = append(reasons, "price_currency_mismatch")
	}
	if len(p.media) == 0 {
		reasons = append(reasons, "missing_media")
	}
	sellable := false
	for _, v := range p.variants {
		for _, sk := range v.skus {
			if sk.status != "active" {
				continue
			}
			for _, snap := range s.sellerInventory {
				if snap.skuID != sk.id || snap.onHand-snap.reserved <= 0 {
					continue
				}
				for _, l := range s.sellerLocations {
					if l.id == snap.locationID && l.status == "active" {
						sellable = true
					}
				}
			}
		}
	}
	if !sellable {
		reasons = append(reasons, "missing_sellable_inventory")
	}
	if reasons == nil {
		return map[string]any{"is_ready": true}
	}
	return map[string]any{"is_ready": false, "reasons": reasons}
}

// --- publish / unpublish ---

func (s *fakeCoreServer) handlePublish(w http.ResponseWriter, r *http.Request, productID string, publish bool) {
	s.mu.Lock()
	p := s.findProduct(productID)
	if p == nil {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	if publish {
		readiness := s.publishReadiness(p)
		if ready, _ := readiness["is_ready"].(bool); !ready {
			s.mu.Unlock()
			writeCoreError(w, http.StatusUnprocessableEntity, "validation_error", "product is not ready to publish")
			return
		}
		p.status = "active"
		p.listingStatus = "active"
		p.updatedAt = time.Now().UTC()

		// Publish into the storefront projection for store-a.localhost and
		// bump the revision so storefront-api caches invalidate.
		if store, ok := s.stores[fakeStoreHost]; ok {
			filtered := store.products[:0]
			for _, sp := range store.products {
				if sp["slug"] != p.slug {
					filtered = append(filtered, sp)
				}
			}
			store.products = append(filtered, s.storefrontProductFor(p))
			store.revision++
		}
		s.mu.Unlock()
		w.WriteHeader(http.StatusOK)
		return
	}

	p.status = "inactive"
	p.listingStatus = "inactive"
	p.updatedAt = time.Now().UTC()
	if store, ok := s.stores[fakeStoreHost]; ok {
		filtered := store.products[:0]
		for _, sp := range store.products {
			if sp["slug"] != p.slug {
				filtered = append(filtered, sp)
			}
		}
		store.products = filtered
		store.revision++
	}
	s.mu.Unlock()
	w.WriteHeader(http.StatusOK)
}

// titleCase renders a category slug as a display name ("beverages" -> "Beverages").
func titleCase(slug string) string {
	if slug == "" {
		return slug
	}
	return strings.ToUpper(slug[:1]) + slug[1:]
}

// storefrontProductFor projects a published seller product into the public
// storefront product shape the storefront endpoints serve.
func (s *fakeCoreServer) storefrontProductFor(p *sellerProduct) map[string]any {
	name := s.translationValue(p, "name")
	description := s.translationValue(p, "description")

	// Public media ordering mirrors Core's storefront projection: the primary
	// image is always first, then sort order, then creation order.
	sorted := make([]*sellerMediaRecord, len(p.media))
	copy(sorted, p.media)
	sort.SliceStable(sorted, func(i, j int) bool {
		if sorted[i].isPrimary != sorted[j].isPrimary {
			return sorted[i].isPrimary
		}
		if sorted[i].sortOrder != sorted[j].sortOrder {
			return sorted[i].sortOrder < sorted[j].sortOrder
		}
		return sorted[i].createdAt.Before(sorted[j].createdAt)
	})

	images := []any{}
	var primary map[string]any
	for _, m := range sorted {
		img := map[string]any{"uri": m.uri, "alt_text": m.altText}
		images = append(images, img)
		if m.isPrimary && primary == nil {
			primary = img
		}
	}
	if primary == nil && len(images) > 0 {
		primary = images[0].(map[string]any)
	}
	if primary == nil {
		primary = map[string]any{"uri": "", "alt_text": name}
	}

	categories := []any{}
	var firstCategory map[string]any
	for _, id := range p.categoryIDs {
		for _, cat := range s.sellerCategories {
			if cat["id"] == id {
				slug, _ := cat["slug"].(string)
				entry := map[string]any{"slug": slug, "name": titleCase(slug)}
				categories = append(categories, entry)
				if firstCategory == nil {
					firstCategory = entry
				}
			}
		}
	}

	variants := []any{}
	for _, v := range p.variants {
		if v.status != "active" {
			continue
		}
		skus := []any{}
		for _, sk := range v.skus {
			if sk.status != "active" {
				continue
			}
			skus = append(skus, map[string]any{"id": sk.id, "availability": "in_stock"})
		}
		variants = append(variants, map[string]any{
			"code":         v.code,
			"availability": "in_stock",
			"skus":         skus,
		})
	}

	priceAmount := p.priceAmount
	return map[string]any{
		"slug":         p.slug,
		"name":         name,
		"summary":      description,
		"description":  description,
		"availability": "in_stock",
		"price": map[string]any{
			"amount_minor": priceAmount,
			"currency":     p.priceCurrency,
		},
		"image":      primary,
		"images":     images,
		"category":   firstCategory,
		"categories": categories,
		"variants":   variants,
	}
}

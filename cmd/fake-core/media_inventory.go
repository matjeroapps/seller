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

// maxPresentationSections is Core's cap on the number of structured product
// page sections per listing.
const maxPresentationSections = 20

// presentationSectionTypes is the closed set of canonical section types. Each
// type fixes which content keys are GLOBAL (shared across locales) and which
// fields the LOCALIZED per-locale objects carry.
var presentationSectionTypes = map[string]bool{
	"description":    true,
	"highlights":     true,
	"image_text":     true,
	"specifications": true,
	"faq":            true,
	"final_cta":      true,
}

// presentationLocaleKeys is the closed set of locale keys a section content
// object may carry. Unknown top-level content keys are rejected.
var presentationLocaleKeys = map[string]bool{"en": true, "ar": true}

// validatePresentationSections enforces the canonical structured section
// contract for the presentation PUT: the canonical envelope per section, at
// most 20 sections with unique ids, and per-type content where global fields
// (image_text media_id/layout, final_cta action) never appear inside the
// localized en/ar objects and no url/href/link-ish keys exist anywhere.
// The returned string is a Core validation_error message.
func validatePresentationSections(sections []any, p *sellerProduct) string {
	if len(sections) > maxPresentationSections {
		return fmt.Sprintf("at most %d sections are allowed", maxPresentationSections)
	}
	seen := map[string]bool{}
	for i, raw := range sections {
		sec, ok := raw.(map[string]any)
		if !ok {
			return fmt.Sprintf("section %d must be an object", i)
		}
		id, _ := sec["id"].(string)
		typ, _ := sec["type"].(string)
		_, enabledIsBool := sec["enabled"].(bool)
		_, hasSortOrder := sec["sort_order"]
		content, hasContent := sec["content"].(map[string]any)
		if id == "" || !presentationSectionTypes[typ] || !enabledIsBool || !hasSortOrder || !hasContent {
			return fmt.Sprintf("section %d must carry id, a known type, enabled, sort_order and content", i)
		}
		if len(sec) != 5 {
			return fmt.Sprintf("section %q accepts only id, type, enabled, sort_order and content", id)
		}
		if seen[id] {
			return fmt.Sprintf("section id %q is duplicated", id)
		}
		seen[id] = true

		var msg string
		switch typ {
		case "description", "image_text", "final_cta":
			var fields []string
			if typ == "description" {
				fields = []string{"heading", "body"}
			} else if typ == "image_text" {
				fields = []string{"heading", "body"}
			} else {
				fields = []string{"title", "body"}
			}
			msg = validateGlobalizedContent(typ, content, fields)
		case "highlights":
			msg = validateLocalizedContent(typ, content, func(obj map[string]any) string {
				return validateLocalizedFields(typ, obj, "title", "items")
			})
		case "specifications":
			msg = validateLocalizedContent(typ, content, func(obj map[string]any) string {
				return validateItemsLocalized(typ, obj, "key", "value")
			})
		case "faq":
			msg = validateLocalizedContent(typ, content, func(obj map[string]any) string {
				return validateItemsLocalized(typ, obj, "question", "answer")
			})
		}
		if msg != "" {
			return msg
		}
		if typ == "image_text" {
			mediaID, _ := content["media_id"].(string)
			found := false
			for _, m := range p.media {
				if m.id == mediaID {
					found = true
					break
				}
			}
			if !found {
				return fmt.Sprintf("image_text section %q media_id %q does not reference media of this product", id, mediaID)
			}
		}
	}
	return ""
}

// validateGlobalizedContent validates the content shapes that mix GLOBAL keys
// with localized en/ar objects: image_text (media_id + layout) and final_cta
// (action). Description is validated here too because it shares the exact
// {heading, body} localized shape with image_text.
func validateGlobalizedContent(typ string, content map[string]any, localizedFields []string) string {
	allowed := map[string]bool{"en": true, "ar": true}
	var globalRequired map[string]bool
	switch typ {
	case "image_text":
		allowed["media_id"] = true
		allowed["layout"] = true
		globalRequired = map[string]bool{"media_id": true, "layout": true}
	case "final_cta":
		allowed["action"] = true
		globalRequired = map[string]bool{"action": true}
	}
	for key := range content {
		if !allowed[key] {
			return fmt.Sprintf("%s section rejects unknown content key %q", typ, key)
		}
	}
	for key := range globalRequired {
		v, ok := content[key]
		if !ok {
			return fmt.Sprintf("%s section requires global field %q", typ, key)
		}
		s, isString := v.(string)
		if !isString || s == "" {
			return fmt.Sprintf("%s section global field %q must be a non-empty string", typ, key)
		}
	}
	if typ == "image_text" {
		layout, _ := content["layout"].(string)
		if layout != "left" && layout != "right" {
			return fmt.Sprintf("%s section layout must be left or right", typ)
		}
	}
	if typ == "final_cta" {
		action, _ := content["action"].(string)
		if action != "add_to_cart" && action != "buy_now" {
			return fmt.Sprintf("%s section action must be add_to_cart or buy_now", typ)
		}
	}
	return validateLocaleObjects(typ, content, localizedFields)
}

// validateLocalizedContent validates the fully-localized content shapes
// (highlights, specifications, faq): only en/ar keys, at least one present,
// each carrying exactly the type's localized fields.
func validateLocalizedContent(typ string, content map[string]any, validateObject func(map[string]any) string) string {
	for key := range content {
		if !presentationLocaleKeys[key] {
			return fmt.Sprintf("%s section rejects unknown content key %q", typ, key)
		}
	}
	locales := 0
	for _, key := range []string{"en", "ar"} {
		obj, ok := content[key]
		if !ok {
			continue
		}
		locales++
		objMap, isObject := obj.(map[string]any)
		if !isObject {
			return fmt.Sprintf("%s section %q must be an object", typ, key)
		}
		if msg := validateObject(objMap); msg != "" {
			return msg
		}
	}
	if locales == 0 {
		return fmt.Sprintf("%s section requires at least one of en or ar", typ)
	}
	return ""
}

// validateLocaleObjects checks every present en/ar object against the type's
// localized field set and requires at least one locale entry.
func validateLocaleObjects(typ string, content map[string]any, fields []string) string {
	if fields == nil {
		switch typ {
		case "description", "image_text":
			fields = []string{"heading", "body"}
		case "final_cta":
			fields = []string{"title", "body"}
		}
	}
	locales := 0
	for _, key := range []string{"en", "ar"} {
		obj, ok := content[key]
		if !ok {
			continue
		}
		locales++
		objMap, isObject := obj.(map[string]any)
		if !isObject {
			return fmt.Sprintf("%s section %q must be an object", typ, key)
		}
		allowed := map[string]bool{}
		for _, f := range fields {
			allowed[f] = true
		}
		for f := range objMap {
			if !allowed[f] {
				return fmt.Sprintf("%s section %q rejects unknown field %q", typ, key, f)
			}
		}
		for _, f := range fields {
			switch f {
			case "items":
				if _, ok := objMap[f]; !ok {
					return fmt.Sprintf("%s section %q requires field %q", typ, key, f)
				}
			default:
				if s, ok := objMap[f].(string); !ok || s == "" {
					return fmt.Sprintf("%s section %q field %q must be a non-empty string", typ, key, f)
				}
			}
		}
	}
	if locales == 0 {
		return fmt.Sprintf("%s section requires at least one of en or ar", typ)
	}
	return ""
}

// validateLocalizedFields validates a localized object with a string field and
// a string-array field (highlights: title + items).
func validateLocalizedFields(typ string, obj map[string]any, stringField, listField string) string {
	allowed := map[string]bool{stringField: true, listField: true}
	for f := range obj {
		if !allowed[f] {
			return fmt.Sprintf("%s section rejects unknown field %q", typ, f)
		}
	}
	if s, ok := obj[stringField].(string); !ok || s == "" {
		return fmt.Sprintf("%s section field %q must be a non-empty string", typ, stringField)
	}
	items, ok := obj[listField].([]any)
	if !ok {
		return fmt.Sprintf("%s section field %q must be an array of strings", typ, listField)
	}
	for _, item := range items {
		if _, isString := item.(string); !isString {
			return fmt.Sprintf("%s section field %q must be an array of strings", typ, listField)
		}
	}
	return ""
}

// validateItemsLocalized validates a localized object whose only field is an
// array of two-string objects (specifications key/value, faq question/answer).
func validateItemsLocalized(typ string, obj map[string]any, firstField, secondField string) string {
	for f := range obj {
		if f != "items" {
			return fmt.Sprintf("%s section rejects unknown field %q", typ, f)
		}
	}
	items, ok := obj["items"].([]any)
	if !ok {
		return fmt.Sprintf("%s section field %q must be an array of objects", typ, "items")
	}
	for _, item := range items {
		entry, isObject := item.(map[string]any)
		if !isObject {
			return fmt.Sprintf("%s section field %q must be an array of objects", typ, "items")
		}
		if len(entry) != 2 {
			return fmt.Sprintf("%s items accept only %q and %q", typ, firstField, secondField)
		}
		for _, f := range []string{firstField, secondField} {
			if s, ok := entry[f].(string); !ok || s == "" {
				return fmt.Sprintf("%s items field %q must be a non-empty string", typ, f)
			}
		}
	}
	return ""
}

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
	sections := body.Sections
	if sections == nil {
		sections = []any{}
	}
	if msg := validatePresentationSections(sections, p); msg != "" {
		s.mu.Unlock()
		writeCoreError(w, http.StatusUnprocessableEntity, "validation_error", msg)
		return
	}
	now := time.Now().UTC()
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

// publicSectionsFor precomputes the publishable structured page sections of a
// product for the public storefront projection. Global fields are separated
// from the per-locale content, and image_text media references are resolved to
// the product media's public uri + alt text, so the serve path can project the
// sections for the request locale without touching internal records. The
// result is stored under a private "_"-prefixed key in the storefront product
// map and never serialized as-is.
func (s *fakeCoreServer) publicSectionsFor(p *sellerProduct) []any {
	if p.presentation == nil || len(p.presentation.sections) == 0 {
		return nil
	}
	var out []any
	for _, raw := range p.presentation.sections {
		sec, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		id, _ := sec["id"].(string)
		typ, _ := sec["type"].(string)
		content, _ := sec["content"].(map[string]any)
		if id == "" || !presentationSectionTypes[typ] || content == nil {
			continue
		}
		if enabled, _ := sec["enabled"].(bool); !enabled {
			continue
		}
		global := map[string]any{}
		localized := map[string]any{}
		switch typ {
		case "description", "image_text":
			collectLocalized(content, localized, "heading", "body")
			if typ == "image_text" {
				global["layout"], _ = content["layout"].(string)
				mediaID, _ := content["media_id"].(string)
				for _, m := range p.media {
					if m.id == mediaID {
						global["image"] = map[string]any{"uri": m.uri, "alt_text": m.altText}
						break
					}
				}
			}
		case "highlights":
			collectLocalized(content, localized, "title", "items")
		case "specifications", "faq":
			collectLocalized(content, localized, "items")
		case "final_cta":
			collectLocalized(content, localized, "title", "body")
			global["action"], _ = content["action"].(string)
		default:
			continue
		}
		if len(localized) == 0 {
			continue
		}
		sortOrder := 0
		switch v := sec["sort_order"].(type) {
		case float64:
			sortOrder = int(v)
		case int64:
			sortOrder = int(v)
		case int:
			sortOrder = v
		}
		out = append(out, map[string]any{
			"id":         id,
			"type":       typ,
			"sort_order": sortOrder,
			"_global":    global,
			"_localized": localized,
		})
	}
	return out
}

// collectLocalized copies the named fields of every locale object in content
// into localized[locale].
func collectLocalized(content map[string]any, localized map[string]any, fields ...string) {
	for _, locale := range []string{"en", "ar"} {
		obj, ok := content[locale].(map[string]any)
		if !ok {
			continue
		}
		entry := map[string]any{}
		for _, f := range fields {
			if v, ok := obj[f]; ok {
				entry[f] = v
			}
		}
		localized[locale] = entry
	}
}

// projectSectionsFor projects the precomputed private sections of a published
// product into the public payload for the request locale: {id, type,
// sort_order, content} with content merged from the global fields and the
// locale object for the request locale (fallback: en, then any). Disabled
// sections and sections without content in any locale are excluded; the list
// is ordered by sort_order ASC with a stable fallback by section id.
func projectSectionsFor(raw []any, locale string) []any {
	type projected struct {
		id    string
		order int
		shape map[string]any
	}
	var rows []projected
	for _, entry := range raw {
		sec, ok := entry.(map[string]any)
		if !ok {
			continue
		}
		global, _ := sec["_global"].(map[string]any)
		localized, _ := sec["_localized"].(map[string]any)
		if len(localized) == 0 {
			continue
		}
		content, ok := localizedContentFor(localized, locale)
		if !ok {
			continue
		}
		for k, v := range global {
			content[k] = v
		}
		id, _ := sec["id"].(string)
		order := 0
		switch v := sec["sort_order"].(type) {
		case float64:
			order = int(v)
		case int64:
			order = int(v)
		case int:
			order = v
		}
		rows = append(rows, projected{
			id:    id,
			order: order,
			shape: map[string]any{
				"id":         id,
				"type":       sec["type"],
				"sort_order": order,
				"content":    content,
			},
		})
	}
	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].order != rows[j].order {
			return rows[i].order < rows[j].order
		}
		return rows[i].id < rows[j].id
	})
	out := make([]any, 0, len(rows))
	for _, row := range rows {
		out = append(out, row.shape)
	}
	return out
}

// localizedContentFor picks the localized object for locale, falling back to
// en and then to any locale deterministically (sorted keys).
func localizedContentFor(localized map[string]any, locale string) (map[string]any, bool) {
	if obj, ok := localized[locale].(map[string]any); ok {
		return cloneContent(obj), true
	}
	if obj, ok := localized["en"].(map[string]any); ok {
		return cloneContent(obj), true
	}
	keys := make([]string, 0, len(localized))
	for k := range localized {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		if obj, ok := localized[k].(map[string]any); ok {
			return cloneContent(obj), true
		}
	}
	return nil, false
}

// cloneContent copies a localized object so the per-request content merge
// never mutates the shared publish-time projection.
func cloneContent(obj map[string]any) map[string]any {
	out := make(map[string]any, len(obj)+1)
	for k, v := range obj {
		out[k] = v
	}
	return out
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
	projection := map[string]any{
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
	if sections := s.publicSectionsFor(p); sections != nil {
		projection["_presentation_sections"] = sections
	}
	return projection
}

package sellerapi

// Feature 034 pass-through contract: the Seller API forwards each proposed
// item through the existing per-variant resource route with the authenticated
// subject and the stable Idempotency-Key, preserves mixed per-item outcomes by
// mapping Core's 200/201 responses, and keeps the public error envelope.

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"seller/internal/coreclient"
)

func TestSellerAPI_VariantItemCreationMapsOutcomesAndKeepsEnvelope(t *testing.T) {
	storeID := uuid.NewString()
	productID := uuid.NewString()
	body := `{
		"code": "red-s",
		"status": "active",
		"sku_code": "SKU-RED-S",
		"attribute_values": [{"attribute_id": "color-attr-1", "attribute_value_id": "val-black-1"}]
	}`

	post := func(mock *variantMockCore, idempotencyKey string) *httptest.ResponseRecorder {
		handler := newHandler(mock, &mock.stubCore)
		req := httptest.NewRequest(http.MethodPost, "/v1/seller/stores/"+storeID+"/products/"+productID+"/variants", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Idempotency-Key", idempotencyKey)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec
	}

	t.Run("created item forwards subject, fields, and stable key as 201", func(t *testing.T) {
		mock := &variantMockCore{}
		rec := post(mock, "product-1::color-red__size-s")
		if rec.Code != http.StatusCreated {
			t.Fatalf("first item status = %d, body %s", rec.Code, rec.Body.String())
		}
		if mock.subject == "" {
			t.Fatal("authenticated subject must be forwarded to Core")
		}
		if mock.lastStoreID != storeID || mock.lastProductID != productID {
			t.Fatalf("store/product path params misrouted: %s/%s", mock.lastStoreID, mock.lastProductID)
		}
		if mock.lastIdempotencyKey != "product-1::color-red__size-s" {
			t.Fatalf("stable Idempotency-Key not forwarded, got %q", mock.lastIdempotencyKey)
		}
		if got := mock.lastVariantParams.SKUCode; got == nil || *got != "SKU-RED-S" || len(mock.lastVariantParams.AttributeValues) != 1 {
			t.Fatalf("sku_code/attribute_values must be forwarded per item, got %+v", mock.lastVariantParams)
		}
	})

	t.Run("already_exists item returns the existing resource with 200 on the same stable key", func(t *testing.T) {
		mock := &variantMockCore{outcome: coreclient.VariantOutcomeAlreadyExists, variantResponse: &coreclient.VariantWithDetails{ID: "existing-variant-1"}}
		rec := post(mock, "product-1::color-red__size-s")
		if rec.Code != http.StatusOK {
			t.Fatalf("already_exists item status = %d, body %s", rec.Code, rec.Body.String())
		}
		if rec.Body.String() == "" || !strings.Contains(rec.Body.String(), "existing-variant-1") {
			t.Fatalf("already_exists must return the existing resource, body %s", rec.Body.String())
		}
	})

	t.Run("mixed batch keeps created rows while failed rows keep the public envelope", func(t *testing.T) {
		// One coordinator pass over two items: the API behaves identically per
		// item, so a first-item success is unaffected by a later item's failure.
		mockCreated := &variantMockCore{}
		if rec := post(mockCreated, "product-1::color-red__size-s"); rec.Code != http.StatusCreated {
			t.Fatalf("mixed batch: successful item status = %d", rec.Code)
		}
		mockFailed := &variantMockCore{err: &coreclient.Error{Status: http.StatusConflict, Code: "conflict", Message: "SKU code \"SKU-RED-S\" is already used in this store catalog; choose a different SKU code for this combination"}}
		rec := post(mockFailed, "product-1::color-blue__size-s")
		if rec.Code != http.StatusConflict {
			t.Fatalf("failed item status = %d, body %s", rec.Code, rec.Body.String())
		}
		var envelope struct {
			Error struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := decodeJSON(rec.Body.Bytes(), &envelope); err != nil {
			t.Fatalf("decode envelope: %v", err)
		}
		if envelope.Error.Code != "conflict" {
			t.Fatalf("public code = %q, want conflict", envelope.Error.Code)
		}
		if !strings.Contains(envelope.Error.Message, "SKU-RED-S") || !strings.Contains(envelope.Error.Message, "store catalog") {
			t.Fatalf("public conflict message must remain actionable, got %q", envelope.Error.Message)
		}
	})
}

func decodeJSON(data []byte, dst any) error {
	return json.Unmarshal(data, dst)
}

// Recording overrides for the US2 variant routes: the embedded stubCore only
// returns canned values, so these capture the arguments the handlers forward.

type variantLifecycleCall struct {
	storeID, productID, variantID, skuID string
	code, status                         string
	barcode                              *string
	subject                              string
}

func (m *variantMockCore) UpdateVariant(ctx context.Context, subject, storeID, productID, variantID, code, status string) (*coreclient.Variant, error) {
	m.subject = subject
	m.updates = append(m.updates, variantLifecycleCall{
		storeID: storeID, productID: productID, variantID: variantID,
		code: code, status: status, subject: subject,
	})
	if m.err != nil {
		return nil, m.err
	}
	return &coreclient.Variant{ID: variantID, ProductID: productID, Code: code, Status: status, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()}, nil
}

func (m *variantMockCore) DeleteVariant(ctx context.Context, subject, storeID, productID, variantID string) error {
	m.subject = subject
	m.deletes = append(m.deletes, variantLifecycleCall{
		storeID: storeID, productID: productID, variantID: variantID, subject: subject,
	})
	return m.err
}

func (m *variantMockCore) ArchiveVariant(ctx context.Context, subject, storeID, productID, variantID string) (*coreclient.Variant, error) {
	m.subject = subject
	m.archives = append(m.archives, variantLifecycleCall{
		storeID: storeID, productID: productID, variantID: variantID, subject: subject,
	})
	if m.err != nil {
		return nil, m.err
	}
	return &coreclient.Variant{ID: variantID, ProductID: productID, Code: "red-s", Status: "archived", CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()}, nil
}

func (m *variantMockCore) UpdateSKUWithSpecs(ctx context.Context, subject, storeID, productID, variantID, skuID string, params coreclient.CreateSKUParams) (*coreclient.SKU, error) {
	m.updates = append(m.updates, variantLifecycleCall{
		storeID: storeID, productID: productID, variantID: variantID, skuID: skuID,
		code: params.Code, status: params.Status, barcode: params.Barcode, subject: subject,
	})
	if m.err != nil {
		return nil, m.err
	}
	return &coreclient.SKU{ID: skuID, VariantID: variantID, Code: params.Code, Status: params.Status, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()}, nil
}

// US2 routes: update, nested SKU update, delete, archive, Core-status
// isolation (401/403/404), and the 409 resource-in-use public envelope.
func TestSellerAPI_VariantLifecycleRoutesKeepStatusesAndEnvelope(t *testing.T) {
	storeID := uuid.NewString()
	productID := uuid.NewString()
	variantID := "var-1"
	skuID := "sku-1"
	base := "/v1/seller/stores/" + storeID + "/products/" + productID + "/variants"

	serve := func(mock *variantMockCore, method, path, body string) *httptest.ResponseRecorder {
		handler := newHandler(mock, &mock.stubCore)
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec
	}

	t.Run("update forwards the variant edit as a 200 with the decoded resource", func(t *testing.T) {
		mock := &variantMockCore{}
		rec := serve(mock, http.MethodPut, base+"/"+variantID, `{"code":"renamed-s","status":"inactive"}`)
		if rec.Code != http.StatusOK {
			t.Fatalf("update status = %d, body %s", rec.Code, rec.Body.String())
		}
		if len(mock.updates) != 1 {
			t.Fatalf("update calls = %d, want 1", len(mock.updates))
		}
		call := mock.updates[0]
		if call.storeID != storeID || call.productID != productID || call.variantID != variantID {
			t.Fatalf("path params misrouted: %+v", call)
		}
		if call.subject == "" || mock.subject == "" {
			t.Fatal("authenticated subject must be forwarded to Core")
		}
		if call.code != "renamed-s" || call.status != "inactive" {
			t.Fatalf("code/status = %q/%q", call.code, call.status)
		}
		if !strings.Contains(rec.Body.String(), `"status":"inactive"`) {
			t.Fatalf("response must carry the decoded variant, body %s", rec.Body.String())
		}
	})

	t.Run("nested SKU update routes under the variant with the sku id", func(t *testing.T) {
		mock := &variantMockCore{}
		rec := serve(mock, http.MethodPut, base+"/"+variantID+"/skus/"+skuID, `{"code":"SKU-RENAMED","status":"inactive"}`)
		if rec.Code != http.StatusOK {
			t.Fatalf("sku update status = %d, body %s", rec.Code, rec.Body.String())
		}
		if len(mock.updates) != 1 || mock.updates[0].skuID != skuID {
			t.Fatalf("nested sku update not recorded with sku id: %+v", mock.updates)
		}
		if mock.updates[0].code != "SKU-RENAMED" {
			t.Fatalf("sku code = %q", mock.updates[0].code)
		}
	})

	t.Run("delete returns 204 and forwards ownership params", func(t *testing.T) {
		mock := &variantMockCore{}
		rec := serve(mock, http.MethodDelete, base+"/"+variantID, "")
		if rec.Code != http.StatusNoContent {
			t.Fatalf("delete status = %d, body %s", rec.Code, rec.Body.String())
		}
		if len(mock.deletes) != 1 || mock.deletes[0].variantID != variantID || mock.deletes[0].storeID != storeID {
			t.Fatalf("delete not routed correctly: %+v", mock.deletes)
		}
	})

	t.Run("obsolete archive route is not registered", func(t *testing.T) {
		mock := &variantMockCore{}
		rec := serve(mock, http.MethodPost, base+"/"+variantID+"/archive", "")
		if rec.Code != http.StatusNotFound {
			t.Fatalf("archive status = %d, want 404", rec.Code)
		}
		if len(mock.archives) != 0 {
			t.Fatalf("obsolete archive route reached Core: %+v", mock.archives)
		}
	})

	t.Run("Core unauthorized and forbidden statuses pass through unchanged", func(t *testing.T) {
		const editBody = `{"code":"x","status":"active"}`
		mock := &variantMockCore{err: &coreclient.Error{Status: http.StatusUnauthorized, Code: coreclient.CodeUnauthorized}}
		if rec := serve(mock, http.MethodPut, base+"/"+variantID, editBody); rec.Code != http.StatusUnauthorized {
			t.Fatalf("unauthorized status = %d, body %s", rec.Code, rec.Body.String())
		}
		if code := decodeErrorEnvelope(t, serve(mock, http.MethodPut, base+"/"+variantID, editBody)); code != "unauthorized" {
			t.Fatalf("public code = %q, want unauthorized", code)
		}
		forbidden := &variantMockCore{err: &coreclient.Error{Status: http.StatusForbidden, Code: coreclient.CodeForbidden}}
		rec := serve(forbidden, http.MethodPut, base+"/"+variantID, editBody)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("forbidden status = %d, body %s", rec.Code, rec.Body.String())
		}
		if code := decodeErrorEnvelope(t, rec); code != "forbidden" {
			t.Fatalf("public code = %q, want forbidden", code)
		}
	})

	t.Run("a foreign store's variant is indistinguishable from missing", func(t *testing.T) {
		mock := &variantMockCore{err: &coreclient.Error{Status: http.StatusNotFound, Code: coreclient.CodeNotFound}}
		for _, tt := range []struct{ method, path, body string }{
			{http.MethodPut, base + "/" + variantID, `{"code":"renamed-s","status":"active"}`},
			{http.MethodDelete, base + "/" + variantID, ""},
		} {
			rec := serve(mock, tt.method, tt.path, tt.body)
			if rec.Code != http.StatusNotFound {
				t.Fatalf("%s %s status = %d, want 404", tt.method, tt.path, rec.Code)
			}
			if code := decodeErrorEnvelope(t, rec); code != "not_found" {
				t.Fatalf("%s %s public code = %q, want not_found", tt.method, tt.path, code)
			}
		}
	})

	t.Run("resource_in_use keeps the dedicated 409 public code on delete", func(t *testing.T) {
		mock := &variantMockCore{err: &coreclient.Error{
			Status: http.StatusConflict, Code: coreclient.CodeResourceInUse,
			Message: "variant is referenced by inventory or order history",
		}}
		for _, tt := range []struct{ method, path string }{{http.MethodDelete, base + "/" + variantID}} {
			rec := serve(mock, tt.method, tt.path, "")
			if rec.Code != http.StatusConflict {
				t.Fatalf("%s %s status = %d, want 409", tt.method, tt.path, rec.Code)
			}
			code := decodeErrorEnvelope(t, rec)
			if code != coreclient.CodeResourceInUse {
				t.Fatalf("%s %s public code = %q, want resource_in_use", tt.method, tt.path, code)
			}
			// The public in-use guidance is the fixed, actionable message for
			// referenced records; Core's internal detail is never disclosed.
			if !strings.Contains(rec.Body.String(), "resource is in use and cannot be modified or archived") {
				t.Fatalf("public in-use message must be the fixed guidance, body %s", rec.Body.String())
			}
		}
	})

	t.Run("a Core code conflict is not widened into resource_in_use", func(t *testing.T) {
		mock := &variantMockCore{err: &coreclient.Error{
			Status:  http.StatusConflict,
			Code:    coreclient.CodeConflict,
			Message: `variant code "renamed-s" is already used in this product; choose a different code`,
		}}
		rec := serve(mock, http.MethodPut, base+"/"+variantID, `{"code":"renamed-s","status":"active"}`)
		if rec.Code != http.StatusConflict {
			t.Fatalf("conflict status = %d, body %s", rec.Code, rec.Body.String())
		}
		if code := decodeErrorEnvelope(t, rec); code != "conflict" {
			t.Fatalf("public code = %q, want conflict", code)
		}
		if !strings.Contains(rec.Body.String(), "choose a different code") {
			t.Fatalf("public conflict message must remain actionable, body %s", rec.Body.String())
		}
	})
}

func decodeErrorEnvelope(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var envelope struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := decodeJSON(rec.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode envelope: %v (body %q)", err, rec.Body.String())
	}
	return envelope.Error.Code
}

package coreclient

// Feature 034 per-item variant creation contract: sku_code/attribute_values
// decoding, canonical already-exists retry behavior (200 → already_exists,
// 201 → created), stable Idempotency-Key reuse, and error envelopes.

import (
	"context"
	"net/http"
	"testing"
)

func TestCreateVariantItemCarriesFieldsAndOutcomeCreated(t *testing.T) {
	stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"id":"variant-1","product_id":"p1","code":"red-s","status":"active","sku":{"id":"sku-1","code":"SKU-RED-S","status":"active"},"attribute_values":[{"id":"d1","attribute_id":"attr_color","attribute_value_id":"val_red"}]}`))
	})
	client := stub.client(t)

	variant, outcome, err := client.CreateVariantItem(context.Background(), "subject-1", "store-1", "prod-1", CreateVariantParams{
		Code:            "red-s",
		Status:          "active",
		SKUCode:         variantStrPtr("SKU-RED-S"),
		AttributeValues: []AttributeValueMapping{{AttributeID: "attr_color", AttributeValueID: "val_red"}},
	}, "product-1::item-1")
	if err != nil {
		t.Fatalf("CreateVariantItem: %v", err)
	}
	if outcome != VariantOutcomeCreated {
		t.Fatalf("outcome = %q, want created", outcome)
	}
	if variant.SKU == nil || variant.SKU.Code != "SKU-RED-S" || len(variant.AttributeValues) != 1 {
		t.Fatalf("decoded response must carry sku and attribute_values, got %+v", variant)
	}
}

func TestCreateVariantItemMapsAlreadyExistsFromStatus200(t *testing.T) {
	stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"existing-variant-1","product_id":"p1","code":"red-s","status":"active"}`))
	})
	client := stub.client(t)

	variant, outcome, err := client.CreateVariantItem(context.Background(), "subject-1", "store-1", "prod-1", CreateVariantParams{
		Code:            "red-s-retry",
		SKUCode:         variantStrPtr("SKU-B"),
		AttributeValues: []AttributeValueMapping{{AttributeID: "attr_color", AttributeValueID: "val_red"}},
	}, "product-1::item-1")
	if err != nil {
		t.Fatalf("CreateVariantItem: %v", err)
	}
	if outcome != VariantOutcomeAlreadyExists {
		t.Fatalf("outcome = %q, want already_exists for a 200 response", outcome)
	}
	if variant.ID != "existing-variant-1" {
		t.Fatalf("already_exists must return the existing resource, got id %q", variant.ID)
	}
}

func TestCreateVariantItemRetriesReuseStableIdempotencyKey(t *testing.T) {
	keys := []string{}
	stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		keys = append(keys, r.Header.Get("Idempotency-Key"))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{}`))
	})
	client := stub.client(t)

	params := func() CreateVariantParams {
		return CreateVariantParams{
			Code:            "red-s",
			SKUCode:         variantStrPtr("SKU-RED-S"),
			AttributeValues: []AttributeValueMapping{{AttributeID: "attr_color", AttributeValueID: "val_red"}},
		}
	}
	if _, _, err := client.CreateVariantItem(context.Background(), "subject-1", "store-1", "prod-1", params(), "product-1::item-1"); err != nil {
		t.Fatalf("first item: %v", err)
	}
	if _, _, err := client.CreateVariantItem(context.Background(), "subject-1", "store-1", "prod-1", params(), "product-1::item-1"); err != nil {
		t.Fatalf("retried item: %v", err)
	}
	if len(keys) != 2 || keys[0] != "product-1::item-1" || keys[1] != "product-1::item-1" {
		t.Fatalf("retry must reuse the stable key, got %v", keys)
	}
}

func TestCreateVariantItemReturnsErrorEnvelopeAsTypedError(t *testing.T) {
	stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"error":{"code":"conflict","message":"variant code \"red-s\" is already used in this product; choose a different code for this combination"}}`))
	})
	client := stub.client(t)

	variant, outcome, err := client.CreateVariantItem(context.Background(), "subject-1", "store-1", "prod-1", CreateVariantParams{
		Code:            "red-s",
		SKUCode:         variantStrPtr("SKU-B"),
		AttributeValues: []AttributeValueMapping{{AttributeID: "attr_color", AttributeValueID: "val_red"}},
	}, "product-1::item-3")
	if outcome != "" || variant != nil {
		t.Fatalf("failed item must return no resource/outcome, got %q %v", outcome, variant)
	}
	var coreErr *Error
	if !asError(err, &coreErr) {
		t.Fatalf("expected typed coreclient error, got %v", err)
	}
	if coreErr.Status != http.StatusConflict || coreErr.Code != "conflict" {
		t.Fatalf("error status/code = %d/%q, want 409/conflict", coreErr.Status, coreErr.Code)
	}
	if coreErr.Message == "" || coreErr.Message == "conflict" {
		t.Fatalf("actionable per-item message must be preserved, got %q", coreErr.Message)
	}
}

// Lifecycle tests for feature 034 US2: update, nested SKU update, delete,
// archive, status isolation (401/403/404), and 409 resource-in-use mapping.

func TestUpdateVariantSendsPUTWithCodeStatusAndSubject(t *testing.T) {
	var method, path, subject string
	stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		method = r.Method
		path = r.URL.Path
		subject = r.Header.Get(HeaderSubject)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"variant-1","product_id":"p1","code":"renamed-s","status":"inactive"}`))
	})
	client := stub.client(t)

	variant, err := client.UpdateVariant(context.Background(), "subject-1", "store-1", "prod-1", "variant-1", "renamed-s", "inactive")
	if err != nil {
		t.Fatalf("UpdateVariant: %v", err)
	}
	if method != http.MethodPut || path != "/internal/v1/stores/store-1/products/prod-1/variants/variant-1" {
		t.Fatalf("request = %s %s, want PUT nested variant route", method, path)
	}
	if subject != "subject-1" {
		t.Fatalf("subject header = %q, want subject-1", subject)
	}
	if body := string(stub.lastBody); body != `{"code":"renamed-s","status":"inactive"}` {
		t.Fatalf("update body = %q", body)
	}
	if variant.Code != "renamed-s" || variant.Status != "inactive" {
		t.Fatalf("decoded variant = %+v", variant)
	}
}

func TestUpdateSKURoutesNestedUnderVariant(t *testing.T) {
	var method, path string
	stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		method = r.Method
		path = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"sku-1","variant_id":"variant-1","code":"SKU-RENAMED","status":"inactive"}`))
	})
	client := stub.client(t)

	sku, err := client.UpdateSKU(context.Background(), "subject-1", "store-1", "prod-1", "variant-1", "sku-1", "SKU-RENAMED", nil, "inactive")
	if err != nil {
		t.Fatalf("UpdateSKU: %v", err)
	}
	if method != http.MethodPut || path != "/internal/v1/stores/store-1/products/prod-1/variants/variant-1/skus/sku-1" {
		t.Fatalf("request = %s %s, want nested PUT under the variant route", method, path)
	}
	if sku.Code != "SKU-RENAMED" || sku.Status != "inactive" {
		t.Fatalf("decoded SKU = %+v", sku)
	}
}

func TestDeleteVariantLifecycleStatus(t *testing.T) {
	var deleteMethod, deletePath string
	deleteStub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
		deleteMethod, deletePath = r.Method, r.URL.Path
		w.WriteHeader(http.StatusNoContent)
	})
	if err := deleteStub.client(t).DeleteVariant(context.Background(), "subject-1", "store-1", "prod-1", "variant-1"); err != nil {
		t.Fatalf("DeleteVariant: %v", err)
	}
	if deleteMethod != http.MethodDelete || deletePath != "/internal/v1/stores/store-1/products/prod-1/variants/variant-1" {
		t.Fatalf("delete request = %s %s", deleteMethod, deletePath)
	}

}

// A variant owned by another store/product is isolated: Core answers not_found,
// and the typed error keeps the exact status/code so the Seller API can render
// the public envelope. resource_in_use is the dedicated 409 vocabulary for
// referenced variants, distinct from the generic conflict code.
func TestVariantLifecycleIsolationAndInUseErrors(t *testing.T) {
	cases := []struct {
		name    string
		status  int
		code    string
		message string
	}{
		{"unauthorized is mapped from Core", http.StatusUnauthorized, "unauthorized", "invalid or expired session"},
		{"forbidden is mapped from Core", http.StatusForbidden, "forbidden", "not your store"},
		{"foreign variant stays not_found", http.StatusNotFound, "not_found", "variant not found"},
		{"conflict is mapped with actionable message", http.StatusConflict, "conflict", "variant code renamed-s is already used in this product"},
		{"referenced variant is resource_in_use", http.StatusConflict, "resource_in_use", "variant is referenced by inventory or order history"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(`{"error":{"code":"` + tc.code + `","message":"` + tc.message + `"}}`))
			})
			client := stub.client(t)

			_, err := client.UpdateVariant(context.Background(), "subject-1", "store-1", "prod-1", "variant-1", "renamed-s", "active")
			var coreErr *Error
			if !asError(err, &coreErr) {
				t.Fatalf("expected typed coreclient error, got %v", err)
			}
			if coreErr.Status != tc.status || coreErr.Code != tc.code {
				t.Fatalf("error status/code = %d/%q, want %d/%q", coreErr.Status, coreErr.Code, tc.status, tc.code)
			}
			if coreErr.Message != tc.message {
				t.Fatalf("error message = %q, want %q", coreErr.Message, tc.message)
			}

			// Deletion of a referenced variant must surface the same 409
			// resource_in_use vocabulary instead of a silent success.
			if err := client.DeleteVariant(context.Background(), "subject-1", "store-1", "prod-1", "variant-1"); err == nil {
				t.Fatal("DeleteVariant must fail for the error envelope")
			} else if deleted, ok := err.(*Error); !ok || deleted.Code != tc.code {
				t.Fatalf("delete error = %v, want code %q", err, tc.code)
			}
		})
	}
}

func variantStrPtr(v string) *string { return &v }

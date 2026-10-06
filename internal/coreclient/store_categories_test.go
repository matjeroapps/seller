package coreclient

// Contract tests for the store-scoped category client methods. They pin the
// paths, methods, headers and body shapes Core's store category endpoints
// expect, and the error decoding the BFF relies on.

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestStoreCategoryContractPathsAndBodies(t *testing.T) {
	ctx := context.Background()
	const subject = "subject-1"
	const storeID = "store-1"
	const categoryID = "cat-1"

	t.Run("list sends seller caller and subject, decodes envelope", func(t *testing.T) {
		var gotAuth, gotService, gotSubject string
		stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
			gotAuth = r.Header.Get("Authorization")
			gotService = r.Header.Get(HeaderService)
			gotSubject = r.Header.Get(HeaderSubject)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"items":[{"id":"cat-1","store_id":"store-1","parent_category_id":null,"slug":"winter","status":"active","sort_order":2,"translations":{"en":{"name":"Winter","description":""}},"product_count":3,"child_count":0,"created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z"}],"total":1,"limit":100,"offset":0}`))
		})
		client := stub.client(t)

		items, err := client.ListStoreCategories(ctx, subject, storeID, "", 100, 0)
		if err != nil {
			t.Fatalf("ListStoreCategories: %v", err)
		}
		if gotAuth != "Bearer "+testToken || gotService != testService || gotSubject != subject {
			t.Fatalf("auth headers = %q/%q/%q", gotAuth, gotService, gotSubject)
		}
		if !strings.HasSuffix(stub.last.URL.Path, "/internal/v1/stores/store-1/categories") {
			t.Fatalf("path = %s", stub.last.URL.Path)
		}
		if len(items) != 1 || items[0].Slug != "winter" || items[0].Translations["en"].Name != "Winter" || items[0].ProductCount != 3 {
			t.Fatalf("decoded items = %+v", items)
		}
	})

	t.Run("create posts the map-form translations body", func(t *testing.T) {
		var body map[string]any
		var stub *stubCore
		stub = newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
			_ = json.Unmarshal(stub.lastBody, &body)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"id":"cat-new","store_id":"store-1","slug":"winter","status":"active","sort_order":0,"translations":{"en":{"name":"Winter"}},"product_count":0,"child_count":0}`))
		})
		client := stub.client(t)

		created, err := client.CreateStoreCategory(ctx, subject, storeID, StoreCategoryInput{
			Slug:         "winter",
			Translations: map[string]StoreCategoryTranslation{"en": {Name: "Winter"}},
		})
		if err != nil {
			t.Fatalf("CreateStoreCategory: %v", err)
		}
		if body["slug"] != "winter" {
			t.Fatalf("body = %v", body)
		}
		if created.ID != "cat-new" {
			t.Fatalf("created = %+v", created)
		}
	})

	t.Run("update sends explicit clear_parent flag", func(t *testing.T) {
		var body map[string]any
		var stub *stubCore
		stub = newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
			_ = json.Unmarshal(stub.lastBody, &body)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{}`))
		})
		client := stub.client(t)

		clear := true
		if _, err := client.UpdateStoreCategory(ctx, subject, storeID, categoryID, StoreCategoryUpdateInput{
			ClearParent:  clear,
			Translations: map[string]StoreCategoryTranslation{"en": {Name: "Winter"}},
		}); err != nil {
			t.Fatalf("UpdateStoreCategory: %v", err)
		}
		if body["clear_parent"] != true {
			t.Fatalf("body = %v", body)
		}
		if !strings.HasSuffix(stub.last.URL.Path, "/internal/v1/stores/store-1/categories/cat-1") {
			t.Fatalf("path = %s", stub.last.URL.Path)
		}
	})

	t.Run("status posts to the status route", func(t *testing.T) {
		var body map[string]any
		var stub *stubCore
		stub = newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
			_ = json.Unmarshal(stub.lastBody, &body)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"id":"cat-1","status":"archived"}`))
		})
		client := stub.client(t)

		if _, err := client.UpdateStoreCategoryStatus(ctx, subject, storeID, categoryID, "archived"); err != nil {
			t.Fatalf("UpdateStoreCategoryStatus: %v", err)
		}
		if !strings.HasSuffix(stub.last.URL.Path, "/internal/v1/stores/store-1/categories/cat-1/status") {
			t.Fatalf("path = %s", stub.last.URL.Path)
		}
		if body["status"] != "archived" {
			t.Fatalf("body = %v", body)
		}
	})

	t.Run("delete uses the DELETE verb on the category path", func(t *testing.T) {
		stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"status":"ok"}`))
		})
		client := stub.client(t)

		if err := client.DeleteStoreCategory(ctx, subject, storeID, categoryID); err != nil {
			t.Fatalf("DeleteStoreCategory: %v", err)
		}
		if stub.last.Method != http.MethodDelete {
			t.Fatalf("method = %s", stub.last.Method)
		}
	})

	t.Run("reorder posts the ordered pairs", func(t *testing.T) {
		var body struct {
			Order []StoreCategoryReorderEntry `json:"order"`
		}
		var stub *stubCore
		stub = newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
			_ = json.Unmarshal(stub.lastBody, &body)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"items":[],"total":0,"limit":0,"offset":0}`))
		})
		client := stub.client(t)

		err := client.ReorderStoreCategories(ctx, subject, storeID, []StoreCategoryReorderEntry{
			{ID: "b", SortOrder: 0},
			{ID: "a", SortOrder: 1},
		})
		if err != nil {
			t.Fatalf("ReorderStoreCategories: %v", err)
		}
		if len(body.Order) != 2 || body.Order[0].ID != "b" || body.Order[0].SortOrder != 0 {
			t.Fatalf("body = %+v", body)
		}
		if !strings.HasSuffix(stub.last.URL.Path, "/internal/v1/stores/store-1/categories/reorder") {
			t.Fatalf("path = %s", stub.last.URL.Path)
		}
	})
}

func TestStoreCategoryContractErrorDecoding(t *testing.T) {
	ctx := context.Background()
	cases := []struct {
		name       string
		status     int
		payload    string
		wantStatus int
		wantCode   string
	}{
		{"not found", http.StatusNotFound, `{"error":{"code":"not_found","message":"resource not found"}}`, http.StatusNotFound, "not_found"},
		{"conflict", http.StatusConflict, `{"error":{"code":"conflict","message":"conflict"}}`, http.StatusConflict, "conflict"},
		{"validation", http.StatusBadRequest, `{"error":{"code":"validation_error","message":"invalid input"}}`, http.StatusBadRequest, "validation_error"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			stub := newStubCore(t, func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(tc.payload))
			})
			client := stub.client(t)

			_, err := client.GetStoreCategory(ctx, "subject-1", "store-1", "cat-1")
			var coreErr *Error
			if !errors.As(err, &coreErr) {
				t.Fatalf("err = %v, want *Error", err)
			}
			if coreErr.Status != tc.wantStatus || coreErr.Code != tc.wantCode {
				t.Fatalf("err = %+v, want status %d code %s", coreErr, tc.wantStatus, tc.wantCode)
			}
		})
	}
}

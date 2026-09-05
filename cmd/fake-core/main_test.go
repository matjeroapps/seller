package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFakeCoreCartLifecycleAndFinalizeReplay(t *testing.T) {
	srv := newServer("test-token")

	// 1. Create Cart
	reqCart := httptest.NewRequest(http.MethodPost, "/internal/v1/storefront/carts", nil)
	reqCart.Header.Set("Authorization", "Bearer test-token")
	reqCart.Header.Set("X-Matjero-Service", "seller")
	reqCart.Header.Set("X-Matjero-Storefront-Host", "store-a.localhost")
	recCart := httptest.NewRecorder()
	srv.ServeHTTP(recCart, reqCart)

	if recCart.Code != http.StatusOK {
		t.Fatalf("create cart status = %d, body %q", recCart.Code, recCart.Body.String())
	}
	var cartRes struct {
		ID        string `json:"id"`
		CartToken string `json:"cart_token"`
	}
	_ = json.NewDecoder(recCart.Body).Decode(&cartRes)
	cartToken := cartRes.CartToken

	// 2. Add Item to Cart
	reqAdd := httptest.NewRequest(http.MethodPost, "/internal/v1/storefront/carts/items", bytes.NewBufferString(`{"sku_id":"sku-a-1","quantity":1}`))
	reqAdd.Header.Set("Authorization", "Bearer test-token")
	reqAdd.Header.Set("X-Matjero-Service", "seller")
	reqAdd.Header.Set("X-Matjero-Storefront-Host", "store-a.localhost")
	reqAdd.Header.Set("X-Matjero-Cart-Token", cartToken)
	recAdd := httptest.NewRecorder()
	srv.ServeHTTP(recAdd, reqAdd)
	if recAdd.Code != http.StatusOK {
		t.Fatalf("add item status = %d, body %q", recAdd.Code, recAdd.Body.String())
	}

	// 3. Create Checkout Session
	reqSess := httptest.NewRequest(http.MethodPost, "/internal/v1/storefront/checkout-sessions", nil)
	reqSess.Header.Set("Authorization", "Bearer test-token")
	reqSess.Header.Set("X-Matjero-Service", "seller")
	reqSess.Header.Set("X-Matjero-Storefront-Host", "store-a.localhost")
	reqSess.Header.Set("X-Matjero-Cart-Token", cartToken)
	recSess := httptest.NewRecorder()
	srv.ServeHTTP(recSess, reqSess)
	if recSess.Code != http.StatusOK {
		t.Fatalf("create session status = %d, body %q", recSess.Code, recSess.Body.String())
	}
	var sessRes struct {
		ID string `json:"id"`
	}
	_ = json.NewDecoder(recSess.Body).Decode(&sessRes)
	sessionID := sessRes.ID

	// 4. Finalize Checkout Session (1st time)
	reqFin1 := httptest.NewRequest(http.MethodPost, "/internal/v1/storefront/checkout-sessions/"+sessionID+"/finalize", bytes.NewBufferString(`{"contact_email":"jane@example.com"}`))
	reqFin1.Header.Set("Authorization", "Bearer test-token")
	reqFin1.Header.Set("X-Matjero-Service", "seller")
	reqFin1.Header.Set("X-Matjero-Storefront-Host", "store-a.localhost")
	recFin1 := httptest.NewRecorder()
	srv.ServeHTTP(recFin1, reqFin1)
	if recFin1.Code != http.StatusOK {
		t.Fatalf("finalize status = %d, body %q", recFin1.Code, recFin1.Body.String())
	}
	var order1 struct {
		ID          string `json:"id"`
		OrderNumber string `json:"order_number"`
	}
	_ = json.NewDecoder(recFin1.Body).Decode(&order1)

	// 5. Verify Cart is now checked_out and operations on Cart fail with 409 conflict
	reqGetCart := httptest.NewRequest(http.MethodGet, "/internal/v1/storefront/carts", nil)
	reqGetCart.Header.Set("Authorization", "Bearer test-token")
	reqGetCart.Header.Set("X-Matjero-Service", "seller")
	reqGetCart.Header.Set("X-Matjero-Storefront-Host", "store-a.localhost")
	reqGetCart.Header.Set("X-Matjero-Cart-Token", cartToken)
	recGetCart := httptest.NewRecorder()
	srv.ServeHTTP(recGetCart, reqGetCart)
	if recGetCart.Code != http.StatusConflict {
		t.Errorf("GET checked-out cart status = %d, want 409 conflict", recGetCart.Code)
	}

	reqAddStale := httptest.NewRequest(http.MethodPost, "/internal/v1/storefront/carts/items", bytes.NewBufferString(`{"sku_id":"sku-a-1","quantity":1}`))
	reqAddStale.Header.Set("Authorization", "Bearer test-token")
	reqAddStale.Header.Set("X-Matjero-Service", "seller")
	reqAddStale.Header.Set("X-Matjero-Storefront-Host", "store-a.localhost")
	reqAddStale.Header.Set("X-Matjero-Cart-Token", cartToken)
	recAddStale := httptest.NewRecorder()
	srv.ServeHTTP(recAddStale, reqAddStale)
	if recAddStale.Code != http.StatusConflict {
		t.Errorf("Add item to checked-out cart status = %d, want 409 conflict", recAddStale.Code)
	}

	// 6. Replay Finalize Checkout Session (2nd time) -> returns same Order
	reqFin2 := httptest.NewRequest(http.MethodPost, "/internal/v1/storefront/checkout-sessions/"+sessionID+"/finalize", bytes.NewBufferString(`{"contact_email":"jane@example.com"}`))
	reqFin2.Header.Set("Authorization", "Bearer test-token")
	reqFin2.Header.Set("X-Matjero-Service", "seller")
	reqFin2.Header.Set("X-Matjero-Storefront-Host", "store-a.localhost")
	recFin2 := httptest.NewRecorder()
	srv.ServeHTTP(recFin2, reqFin2)
	if recFin2.Code != http.StatusOK {
		t.Fatalf("replay finalize status = %d, body %q", recFin2.Code, recFin2.Body.String())
	}
	var order2 struct {
		ID          string `json:"id"`
		OrderNumber string `json:"order_number"`
	}
	_ = json.NewDecoder(recFin2.Body).Decode(&order2)

	if order1.ID != order2.ID {
		t.Errorf("replay order ID mismatch: got %s, want %s", order2.ID, order1.ID)
	}
}

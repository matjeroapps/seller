package sellerapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"seller/internal/audit"
	"seller/internal/coreclient"
	"seller/internal/idempotency"
	"seller/internal/ratelimit"
)

type hardenedStubCore struct {
	stubCore
}

func (s *hardenedStubCore) AuthenticateAPIKey(ctx context.Context, rawKey string) (*coreclient.APIKeyResponse, error) {
	if rawKey == "revoked-key" {
		return nil, &coreclient.Error{Code: coreclient.CodeUnauthorized, Message: "revoked key"}
	}
	if rawKey == "scoped-key-read-only" {
		return &coreclient.APIKeyResponse{
			ID:        "key_readonly",
			ActorType: "seller",
			ActorID:   "store-1",
			Scopes:    []string{"products:read", "orders:read"},
			Status:    "active",
		}, nil
	}
	return &coreclient.APIKeyResponse{
		ID:        "key_full",
		ActorType: "seller",
		ActorID:   "store-1",
		Scopes:    []string{"*"},
		Status:    "active",
	}, nil
}

func (s *hardenedStubCore) AdjustInventory(ctx context.Context, subject, storeID, snapshotID string, req coreclient.AdjustInventoryRequest) (*coreclient.InventorySnapshot, error) {
	return &coreclient.InventorySnapshot{ID: "snap_100", SKUID: "sku_1", OnHandQty: req.DeltaQuantity}, nil
}

func (s *hardenedStubCore) CreateOrderShipment(ctx context.Context, subject, orderID string, req coreclient.CreateShipmentRequest) (*coreclient.ShipmentResponse, error) {
	return &coreclient.ShipmentResponse{ID: "ship_100", OrderID: orderID, TrackingNumber: req.TrackingNumber, Status: "label_created"}, nil
}

func (s *hardenedStubCore) ListOrderShipments(ctx context.Context, subject, orderID string) ([]coreclient.ShipmentResponse, error) {
	return []coreclient.ShipmentResponse{{ID: "ship_100", OrderID: orderID, Status: "label_created"}}, nil
}

func (s *hardenedStubCore) GetShipment(ctx context.Context, subject, shipmentID string) (*coreclient.ShipmentResponse, error) {
	return &coreclient.ShipmentResponse{ID: shipmentID, OrderID: "ord_100", Status: "in_transit"}, nil
}

func (s *hardenedStubCore) UpdateShipmentStatus(ctx context.Context, subject, shipmentID string, req coreclient.UpdateShipmentStatusRequest) (*coreclient.ShipmentResponse, error) {
	return &coreclient.ShipmentResponse{ID: shipmentID, OrderID: "ord_100", Status: req.Status}, nil
}

func TestHardenedPublicIntegrationAPI(t *testing.T) {
	core := &hardenedStubCore{}
	limiter := ratelimit.NewLimiter(nil, 5, 1*time.Minute)
	idempotencyStore := idempotency.NewStore(nil, 1*time.Hour)
	auditLogger := audit.NewLogger(nil)

	deps := Dependencies{
		Core:             core,
		Limiter:          limiter,
		IdempotencyStore: idempotencyStore,
		AuditLogger:      auditLogger,
	}

	router := chi.NewRouter()
	router.Route("/v1", func(r chi.Router) {
		RegisterSellerRoutes(deps)(r)
	})

	t.Run("API Versioning Header check", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/public/products", nil)
		req.Header.Set("X-Matjero-API-Key", "valid-key")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Header().Get("X-API-Version") == "" {
			t.Errorf("expected X-API-Version header on response")
		}
	})

	t.Run("Scoped Authorization - Read-Only Key blocked on Mutation", func(t *testing.T) {
		body := `{"sku_id":"sku_1","quantity_delta":5,"reason":"restock"}`
		req := httptest.NewRequest(http.MethodPost, "/v1/public/inventory/adjustments", strings.NewReader(body))
		req.Header.Set("X-Matjero-API-Key", "scoped-key-read-only")
		req.Header.Set("Idempotency-Key", "idem-key-1")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusForbidden {
			t.Fatalf("expected 403 Forbidden for read-only key on write action, got status %d (body %q)", rec.Code, rec.Body.String())
		}
	})

	t.Run("Public Fulfillment endpoints with full scopes", func(t *testing.T) {
		// List fulfillments
		reqList := httptest.NewRequest(http.MethodGet, "/v1/public/orders/ord_100/fulfillments", nil)
		reqList.Header.Set("X-Matjero-API-Key", "valid-key")
		recList := httptest.NewRecorder()
		router.ServeHTTP(recList, reqList)

		if recList.Code != http.StatusOK {
			t.Fatalf("list fulfillments status = %d, want 200 (body %q)", recList.Code, recList.Body.String())
		}

		// Create fulfillment
		body := `{"fulfillment_location_id":"loc_1","tracking_number":"TRK123","items":[{"order_item_id":"item_1","quantity":1}]}`
		reqCreate := httptest.NewRequest(http.MethodPost, "/v1/public/orders/ord_100/fulfillments", strings.NewReader(body))
		reqCreate.Header.Set("X-Matjero-API-Key", "valid-key")
		reqCreate.Header.Set("Idempotency-Key", "idem-ful-1")
		recCreate := httptest.NewRecorder()
		router.ServeHTTP(recCreate, reqCreate)

		if recCreate.Code != http.StatusCreated {
			t.Fatalf("create fulfillment status = %d, want 201 (body %q)", recCreate.Code, recCreate.Body.String())
		}
	})

	t.Run("Public Webhooks Endpoints Target URL Validation", func(t *testing.T) {
		bodyInvalid := `{"target_url":"invalid-url","subscribed_events":["order.created"]}`
		req := httptest.NewRequest(http.MethodPost, "/v1/public/webhooks/subscriptions", strings.NewReader(bodyInvalid))
		req.Header.Set("X-Matjero-API-Key", "valid-key")
		req.Header.Set("Idempotency-Key", "idem-wh-1")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request for invalid target_url, got %d (body %q)", rec.Code, rec.Body.String())
		}
	})
}

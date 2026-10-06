package sellerapi

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

type inventoryMockCore struct {
	stubCore
	lastStoreID        string
	lastAdjustmentReq  coreclient.DualModeAdjustmentRequest
	lastIdempotencyKey string
	adjustmentResponse *coreclient.DualModeAdjustmentResponse
	err                error
}

func (m *inventoryMockCore) AdjustStoreInventoryDualMode(ctx context.Context, subject, storeID string, req coreclient.DualModeAdjustmentRequest, idempotencyKey string) (*coreclient.DualModeAdjustmentResponse, error) {
	m.subject = subject
	m.lastStoreID = storeID
	m.lastAdjustmentReq = req
	m.lastIdempotencyKey = idempotencyKey
	if m.err != nil {
		return nil, m.err
	}
	if m.adjustmentResponse != nil {
		return m.adjustmentResponse, nil
	}
	delta := int64(0)
	if req.QtyDelta != nil {
		delta = *req.QtyDelta
	} else if req.TargetQty != nil {
		delta = *req.TargetQty - 10
	}
	return &coreclient.DualModeAdjustmentResponse{
		SnapshotID:            uuid.NewString(),
		FulfillmentLocationID: req.FulfillmentLocationID,
		SKUID:                 req.SKUID,
		OnHandQty:             50,
		ReservedQty:           5,
		AvailableQty:          45,
		QuantityDelta:         delta,
		MovementID:            uuid.NewString(),
		ReasonCode:            req.ReasonCode,
		UpdatedAt:             time.Now().UTC(),
	}, nil
}

func TestSellerAPI_InventoryAdjustments_DualMode(t *testing.T) {
	locID := uuid.NewString()
	skuID := uuid.NewString()
	storeID := uuid.NewString()

	t.Run("Relative delta adjustment success", func(t *testing.T) {
		mock := &inventoryMockCore{}
		handler := newHandler(mock, &mock.stubCore)

		body := `{"fulfillment_location_id":"` + locID + `","sku_id":"` + skuID + `","qty_delta":15,"reason_code":"received_stock"}`
		req := httptest.NewRequest(http.MethodPost, "/v1/seller/stores/"+storeID+"/inventory/adjustments", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Idempotency-Key", "test-ik-1")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}
		if mock.lastStoreID != storeID {
			t.Errorf("expected storeID %s, got %s", storeID, mock.lastStoreID)
		}
		if mock.lastAdjustmentReq.QtyDelta == nil || *mock.lastAdjustmentReq.QtyDelta != 15 {
			t.Errorf("expected QtyDelta 15, got %v", mock.lastAdjustmentReq.QtyDelta)
		}
		if mock.lastAdjustmentReq.ReasonCode != "received_stock" {
			t.Errorf("expected reason_code received_stock, got %s", mock.lastAdjustmentReq.ReasonCode)
		}
		if mock.lastIdempotencyKey != "test-ik-1" {
			t.Errorf("expected Idempotency-Key test-ik-1, got %s", mock.lastIdempotencyKey)
		}

		var res map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if res["fulfillment_location_id"] != locID || res["sku_id"] != skuID {
			t.Errorf("unexpected location or sku in response: %v", res)
		}
	})

	t.Run("Cycle count absolute target adjustment success", func(t *testing.T) {
		mock := &inventoryMockCore{}
		handler := newHandler(mock, &mock.stubCore)

		body := `{"fulfillment_location_id":"` + locID + `","sku_id":"` + skuID + `","target_qty":45,"reason_code":"cycle_count_reconciliation"}`
		req := httptest.NewRequest(http.MethodPost, "/v1/seller/stores/"+storeID+"/inventory/adjustments", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}
		if mock.lastAdjustmentReq.TargetQty == nil || *mock.lastAdjustmentReq.TargetQty != 45 {
			t.Errorf("expected TargetQty 45, got %v", mock.lastAdjustmentReq.TargetQty)
		}
		if mock.lastAdjustmentReq.ReasonCode != "cycle_count_reconciliation" {
			t.Errorf("expected reason_code cycle_count_reconciliation, got %s", mock.lastAdjustmentReq.ReasonCode)
		}
	})

	t.Run("Core error propagation - Insufficient Inventory maps to 409", func(t *testing.T) {
		mock := &inventoryMockCore{
			err: &coreclient.Error{Status: http.StatusConflict, Code: coreclient.CodeInsufficientInventory, Message: "insufficient inventory"},
		}
		handler := newHandler(mock, &mock.stubCore)

		body := `{"fulfillment_location_id":"` + locID + `","sku_id":"` + skuID + `","qty_delta":-999,"reason_code":"theft_loss"}`
		req := httptest.NewRequest(http.MethodPost, "/v1/seller/stores/"+storeID+"/inventory/adjustments", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusConflict {
			t.Fatalf("expected 409 Conflict, got %d: %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("Malformed JSON payload returns 400", func(t *testing.T) {
		mock := &inventoryMockCore{}
		handler := newHandler(mock, &mock.stubCore)

		req := httptest.NewRequest(http.MethodPost, "/v1/seller/stores/"+storeID+"/inventory/adjustments", strings.NewReader("{invalid-json"))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request, got %d", rec.Code)
		}
	})
}

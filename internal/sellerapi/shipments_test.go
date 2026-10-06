package sellerapi

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"seller/internal/coreclient"
)

type shipmentsStubCore struct {
	stubCore
	listStoreShipmentsCalled bool
	lastStoreID              string
	lastStatus               string
	lastPage                 int
	lastPageSize             int
	createOrderShipmentCalled bool
	lastOrderID              string
}

func (s *shipmentsStubCore) ListStoreShipments(ctx context.Context, subject, storeID string, status string, page, pageSize int) (*coreclient.StoreShipmentsResponse, error) {
	s.listStoreShipmentsCalled = true
	s.lastStoreID = storeID
	s.lastStatus = status
	s.lastPage = page
	s.lastPageSize = pageSize

	items := []coreclient.ShipmentResponse{
		{
			ID:                    "shp_101",
			OrderID:               "ord_1",
			FulfillmentLocationID: "loc_1",
			Status:                "PENDING",
			CarrierName:           "SMSA Express",
			TrackingNumber:        "TRK-ord_1-shp101",
			ShippingCostMinor:     1500,
			Currency:              "SAR",
			CreatedAt:             time.Now(),
			UpdatedAt:             time.Now(),
		},
		{
			ID:                    "shp_102",
			OrderID:               "ord_2",
			FulfillmentLocationID: "loc_1",
			Status:                "IN_TRANSIT",
			CarrierName:           "Aramex",
			TrackingNumber:        "ARX-123456",
			ShippingCostMinor:     2000,
			Currency:              "SAR",
			CreatedAt:             time.Now(),
			UpdatedAt:             time.Now(),
		},
	}

	if status != "" {
		filtered := make([]coreclient.ShipmentResponse, 0)
		for _, item := range items {
			if item.Status == status {
				filtered = append(filtered, item)
			}
		}
		items = filtered
	}

	return &coreclient.StoreShipmentsResponse{
		Items:      items,
		TotalCount: len(items),
		Page:       page,
		PageSize:   pageSize,
	}, nil
}

func (s *shipmentsStubCore) CreateOrderShipment(ctx context.Context, subject, orderID string, req coreclient.CreateShipmentRequest) (*coreclient.ShipmentResponse, error) {
	s.createOrderShipmentCalled = true
	s.lastOrderID = orderID
	return &coreclient.ShipmentResponse{
		ID:                    "shp_new_99",
		OrderID:               orderID,
		FulfillmentLocationID: req.FulfillmentLocationID,
		Status:                "PENDING",
		CarrierName:           req.CarrierName,
		TrackingNumber:        req.TrackingNumber,
		ShippingCostMinor:     req.ShippingCostMinor,
		Currency:              req.Currency,
		CreatedAt:             time.Now(),
		UpdatedAt:             time.Now(),
	}, nil
}

func TestStoreShipmentsQueueBFF(t *testing.T) {
	core := &shipmentsStubCore{}
	handler := newHandler(core, core)

	t.Run("GET /seller/stores/{store_id}/shipments lists store queue with pagination", func(t *testing.T) {
		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/str_123/shipments?page=1&limit=20", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
		}

		if !core.listStoreShipmentsCalled {
			t.Fatal("expected ListStoreShipments to be called")
		}
		if core.lastStoreID != "str_123" {
			t.Errorf("storeID = %q, want str_123", core.lastStoreID)
		}
		if core.lastPage != 1 || core.lastPageSize != 20 {
			t.Errorf("pagination = (%d, %d), want (1, 20)", core.lastPage, core.lastPageSize)
		}

		var res coreclient.StoreShipmentsResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if len(res.Items) != 2 {
			t.Fatalf("expected 2 items, got %d", len(res.Items))
		}
		if res.Items[0].TrackingNumber != "TRK-ord_1-shp101" {
			t.Errorf("tracking = %q, want TRK-ord_1-shp101", res.Items[0].TrackingNumber)
		}
	})

	t.Run("GET /seller/stores/{store_id}/shipments filters by status", func(t *testing.T) {
		rec := doRequest(t, handler, http.MethodGet, "/v1/seller/stores/str_123/shipments?status=PENDING", "")
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
		}
		if core.lastStatus != "PENDING" {
			t.Errorf("status = %q, want PENDING", core.lastStatus)
		}

		var res coreclient.StoreShipmentsResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if len(res.Items) != 1 || res.Items[0].Status != "PENDING" {
			t.Fatalf("expected 1 PENDING item, got %+v", res.Items)
		}
	})

	t.Run("POST /seller/stores/{store_id}/shipments creates shipment via store endpoint", func(t *testing.T) {
		body := `{"order_id":"ord_555","fulfillment_location_id":"loc_1","carrier_name":"SMSA Express","shipping_cost_minor":1200,"currency":"SAR","items":[{"order_item_id":"item_1","quantity":1}]}`
		rec := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/str_123/shipments", body)
		if rec.Code != http.StatusCreated {
			t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
		}

		if !core.createOrderShipmentCalled {
			t.Fatal("expected CreateOrderShipment to be called")
		}
		if core.lastOrderID != "ord_555" {
			t.Errorf("orderID = %q, want ord_555", core.lastOrderID)
		}

		var created coreclient.ShipmentResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if created.ID != "shp_new_99" || created.CarrierName != "SMSA Express" {
			t.Errorf("unexpected created shipment: %+v", created)
		}
	})

	t.Run("POST /seller/stores/{store_id}/shipments validates required order_id", func(t *testing.T) {
		body := `{"fulfillment_location_id":"loc_1","shipping_cost_minor":1200,"currency":"SAR"}`
		rec := doRequest(t, handler, http.MethodPost, "/v1/seller/stores/str_123/shipments", body)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request when order_id missing, got %d: %s", rec.Code, rec.Body.String())
		}
	})
}

package coreclient

import (
	"context"
	"fmt"
	"net/url"
	"time"
)

type CreateShipmentItemRequest struct {
	OrderItemID string `json:"order_item_id"`
	Quantity    int64  `json:"quantity"`
}

type CreateShipmentRequest struct {
	FulfillmentLocationID string                      `json:"fulfillment_location_id"`
	CarrierName           string                      `json:"carrier_name,omitempty"`
	TrackingNumber        string                      `json:"tracking_number,omitempty"`
	ShippingCostMinor     int64                       `json:"shipping_cost_minor"`
	CodAmountMinor        int64                       `json:"cod_amount_minor"`
	Currency              string                      `json:"currency"`
	Items                 []CreateShipmentItemRequest `json:"items"`
}

type UpdateShipmentStatusRequest struct {
	Status         string `json:"status"`
	TrackingNumber string `json:"tracking_number,omitempty"`
	Notes          string `json:"notes,omitempty"`
}

type ShipmentItemResponse struct {
	ID          string    `json:"id"`
	ShipmentID  string    `json:"shipment_id"`
	OrderItemID string    `json:"order_item_id"`
	Quantity    int64     `json:"quantity"`
	CreatedAt   time.Time `json:"created_at"`
}

type ShipmentEventResponse struct {
	ID         string    `json:"id"`
	ShipmentID string    `json:"shipment_id"`
	Status     string    `json:"status"`
	Notes      string    `json:"notes,omitempty"`
	OccurredAt time.Time `json:"occurred_at"`
}

type ShipmentResponse struct {
	ID                    string                  `json:"id"`
	OrderID               string                  `json:"order_id"`
	FulfillmentLocationID string                  `json:"fulfillment_location_id"`
	Status                string                  `json:"status"`
	CarrierName           string                  `json:"carrier_name,omitempty"`
	TrackingNumber        string                  `json:"tracking_number,omitempty"`
	ShippingCostMinor     int64                   `json:"shipping_cost_minor"`
	CodAmountMinor        int64                   `json:"cod_amount_minor"`
	Currency              string                  `json:"currency"`
	Items                 []ShipmentItemResponse  `json:"items"`
	Events                []ShipmentEventResponse `json:"events,omitempty"`
	CreatedAt             time.Time               `json:"created_at"`
	UpdatedAt             time.Time               `json:"updated_at"`
}

type OrderShipmentsResponse struct {
	Shipments []ShipmentResponse `json:"shipments"`
}

type StoreShipmentsResponse struct {
	Items      []ShipmentResponse `json:"items"`
	TotalCount int                `json:"total_count"`
	Page       int                `json:"page"`
	PageSize   int                `json:"page_size"`
}

func (c *Client) CreateOrderShipment(ctx context.Context, subject, orderID string, req CreateShipmentRequest) (*ShipmentResponse, error) {
	path := fmt.Sprintf("/internal/v1/orders/%s/shipments", url.PathEscape(orderID))
	var res ShipmentResponse
	if err := c.post(ctx, path, req, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) GetShipment(ctx context.Context, subject, shipmentID string) (*ShipmentResponse, error) {
	path := fmt.Sprintf("/internal/v1/shipments/%s", url.PathEscape(shipmentID))
	var res ShipmentResponse
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) UpdateShipmentStatus(ctx context.Context, subject, shipmentID string, req UpdateShipmentStatusRequest) (*ShipmentResponse, error) {
	path := fmt.Sprintf("/internal/v1/shipments/%s/status", url.PathEscape(shipmentID))
	var res ShipmentResponse
	if err := c.patch(ctx, path, req, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) ListOrderShipments(ctx context.Context, subject, orderID string) ([]ShipmentResponse, error) {
	path := fmt.Sprintf("/internal/v1/orders/%s/shipments", url.PathEscape(orderID))
	var res OrderShipmentsResponse
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return res.Shipments, nil
}

func (c *Client) ListStoreShipments(ctx context.Context, subject, storeID string, status string, page, pageSize int) (*StoreShipmentsResponse, error) {
	q := url.Values{}
	if status != "" {
		q.Set("status", status)
	}
	if page > 0 {
		q.Set("page", fmt.Sprintf("%d", page))
	}
	if pageSize > 0 {
		q.Set("limit", fmt.Sprintf("%d", pageSize))
		q.Set("page_size", fmt.Sprintf("%d", pageSize))
	}
	path := fmt.Sprintf("/internal/v1/stores/%s/shipments", url.PathEscape(storeID))
	var res StoreShipmentsResponse
	if err := c.get(ctx, path, q, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

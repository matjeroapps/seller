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

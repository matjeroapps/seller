package coreclient

import (
	"context"
	"fmt"
	"net/url"
	"time"
)

type InitializePaymentRequest struct {
	AmountMinor       int64  `json:"amount_minor"`
	Currency          string `json:"currency"`
	PaymentMethod     string `json:"payment_method"`
	Provider          string `json:"provider,omitempty"`
	ProviderReference string `json:"provider_reference,omitempty"`
}

type UpdatePaymentStatusRequest struct {
	Status            string `json:"status"`
	Provider          string `json:"provider,omitempty"`
	ProviderReference string `json:"provider_reference,omitempty"`
	ErrorMessage      string `json:"error_message,omitempty"`
}

type PaymentAttemptResponse struct {
	ID                string    `json:"id"`
	PaymentID         string    `json:"payment_id"`
	Provider          string    `json:"provider"`
	ProviderReference string    `json:"provider_reference,omitempty"`
	Status            string    `json:"status"`
	ErrorMessage      string    `json:"error_message,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type PaymentResponse struct {
	ID            string                   `json:"id"`
	OrderID       string                   `json:"order_id"`
	AmountMinor   int64                    `json:"amount_minor"`
	Currency      string                   `json:"currency"`
	PaymentMethod string                   `json:"payment_method"`
	Status        string                   `json:"status"`
	Attempts      []PaymentAttemptResponse `json:"attempts,omitempty"`
	CreatedAt     time.Time                `json:"created_at"`
	UpdatedAt     time.Time                `json:"updated_at"`
}

func (c *Client) InitializeOrderPayment(ctx context.Context, subject, orderID string, req InitializePaymentRequest) (*PaymentResponse, error) {
	path := fmt.Sprintf("/internal/v1/orders/%s/payments", url.PathEscape(orderID))
	var res PaymentResponse
	if err := c.post(ctx, path, req, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) GetPayment(ctx context.Context, subject, paymentID string) (*PaymentResponse, error) {
	path := fmt.Sprintf("/internal/v1/payments/%s", url.PathEscape(paymentID))
	var res PaymentResponse
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) GetOrderPayment(ctx context.Context, subject, orderID string) (*PaymentResponse, error) {
	path := fmt.Sprintf("/internal/v1/orders/%s/payments", url.PathEscape(orderID))
	var res PaymentResponse
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) UpdatePaymentStatus(ctx context.Context, subject, paymentID string, req UpdatePaymentStatusRequest) (*PaymentResponse, error) {
	path := fmt.Sprintf("/internal/v1/payments/%s/status", url.PathEscape(paymentID))
	var res PaymentResponse
	if err := c.patch(ctx, path, req, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

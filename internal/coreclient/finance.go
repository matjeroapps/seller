package coreclient

import (
	"context"
	"fmt"
	"net/url"
	"time"
)

type StoreBalanceResponse struct {
	AvailableMinor int64     `json:"available_minor"`
	PendingMinor   int64     `json:"pending_minor"`
	Currency       string    `json:"currency"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type JournalLineResponse struct {
	ID                string    `json:"id"`
	JournalEntryID    string    `json:"journal_entry_id"`
	AccountID         string    `json:"account_id"`
	DebitAmountMinor  int64     `json:"debit_amount_minor"`
	CreditAmountMinor int64     `json:"credit_amount_minor"`
	CreatedAt         time.Time `json:"created_at"`
}

type LedgerEntryResponse struct {
	ID            string                `json:"id"`
	ReferenceType string                `json:"reference_type"`
	ReferenceID   string                `json:"reference_id"`
	Description   string                `json:"description,omitempty"`
	Currency      string                `json:"currency"`
	PostedAt      time.Time             `json:"posted_at"`
	CreatedAt     time.Time             `json:"created_at"`
	Lines         []JournalLineResponse `json:"lines,omitempty"`
}

type SettlementResponse struct {
	ID                    string     `json:"id"`
	SettlementPeriodID    string     `json:"settlement_period_id"`
	AccountID             string     `json:"account_id"`
	Currency              string     `json:"currency"`
	GrossAmountMinor      int64      `json:"gross_amount_minor"`
	AdjustmentAmountMinor int64      `json:"adjustment_amount_minor"`
	NetAmountMinor        int64      `json:"net_amount_minor"`
	Status                string     `json:"status"`
	CreatedAt             time.Time  `json:"created_at"`
	CalculatedAt          *time.Time `json:"calculated_at,omitempty"`
	FinalizedAt           *time.Time `json:"finalized_at,omitempty"`
}

type PayoutResponse struct {
	ID           string    `json:"id"`
	StoreID      string    `json:"store_id"`
	AmountMinor  int64     `json:"amount_minor"`
	Currency     string    `json:"currency"`
	Status       string    `json:"status"`
	PayoutMethod string    `json:"payout_method"`
	Reference    string    `json:"reference,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type CoreCollectionResponse[T any] struct {
	Items []T `json:"items"`
}

func (c *Client) GetStoreBalance(ctx context.Context, subject, storeID string) (*StoreBalanceResponse, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/finance/balance", url.PathEscape(storeID))
	var bal StoreBalanceResponse
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &bal); err != nil {
		return &StoreBalanceResponse{
			AvailableMinor: 0,
			PendingMinor:   0,
			Currency:       "SAR",
			UpdatedAt:      time.Now().UTC(),
		}, nil
	}
	return &bal, nil
}

func (c *Client) ListStoreLedgerEntries(ctx context.Context, subject, storeID string) ([]LedgerEntryResponse, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/finance/ledger", url.PathEscape(storeID))
	var res CoreCollectionResponse[LedgerEntryResponse]
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &res); err != nil {
		return []LedgerEntryResponse{}, nil
	}
	return res.Items, nil
}

func (c *Client) ListStoreSettlements(ctx context.Context, subject, storeID string) ([]SettlementResponse, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/finance/settlements", url.PathEscape(storeID))
	var res CoreCollectionResponse[SettlementResponse]
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &res); err != nil {
		return []SettlementResponse{}, nil
	}
	return res.Items, nil
}

func (c *Client) ListStorePayouts(ctx context.Context, subject, storeID string) ([]PayoutResponse, error) {
	path := fmt.Sprintf("/internal/v1/stores/%s/finance/payouts", url.PathEscape(storeID))
	var res CoreCollectionResponse[PayoutResponse]
	if err := c.get(ctx, path, nil, requestOptions{Subject: subject}, &res); err != nil {
		return nil, err
	}
	return res.Items, nil
}

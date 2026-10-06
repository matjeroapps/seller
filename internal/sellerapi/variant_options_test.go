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

type variantMockCore struct {
	stubCore
	lastStoreID       string
	lastProductID     string
	lastVariantParams coreclient.CreateVariantParams
	legacyCode        string
	legacyStatus      string
	variantResponse   *coreclient.VariantWithDetails
	err               error
}

func (m *variantMockCore) CreateVariantWithOptions(ctx context.Context, subject, storeID, productID string, params coreclient.CreateVariantParams) (*coreclient.VariantWithDetails, error) {
	m.subject = subject
	m.lastStoreID = storeID
	m.lastProductID = productID
	m.lastVariantParams = params
	if m.err != nil {
		return nil, m.err
	}
	if m.variantResponse != nil {
		return m.variantResponse, nil
	}
	skuID := uuid.NewString()
	barcode := ""
	if params.Barcode != nil {
		barcode = *params.Barcode
	}
	skuCode := ""
	if params.SKUCode != nil {
		skuCode = *params.SKUCode
	}
	var length, width, height *int
	if params.Dimensions != nil {
		length = params.Dimensions.LengthMM
		width = params.Dimensions.WidthMM
		height = params.Dimensions.HeightMM
	}
	return &coreclient.VariantWithDetails{
		ID:        uuid.NewString(),
		ProductID: productID,
		Code:      params.Code,
		Status:    params.Status,
		AttributeValues: []coreclient.VariantAttributeValueDetail{
			{
				ID:            uuid.NewString(),
				AttributeID:   "color-attr-1",
				AttributeName: "Color",
				AttributeCode: "color",
				ValueID:       "val-black-1",
				ValueName:     "Black",
				ValueCode:     "black",
			},
		},
		SKU: &coreclient.SKU{
			ID:              skuID,
			Code:            skuCode,
			Barcode:         &barcode,
			Status:          "active",
			WeightGrams:     params.WeightGrams,
			LengthMM:        length,
			WidthMM:         width,
			HeightMM:        height,
			PriceMinorUnits: params.PriceMinorUnits,
			CreatedAt:       time.Now().UTC(),
			UpdatedAt:       time.Now().UTC(),
		},
	}, nil
}

func (m *variantMockCore) CreateVariant(ctx context.Context, subject, storeID, productID, code, status string) (*coreclient.Variant, error) {
	m.subject = subject
	m.lastStoreID = storeID
	m.lastProductID = productID
	m.legacyCode = code
	m.legacyStatus = status
	if m.err != nil {
		return nil, m.err
	}
	return &coreclient.Variant{
		ID:        uuid.NewString(),
		ProductID: productID,
		Code:      code,
		Status:    status,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}, nil
}

func TestSellerAPI_VariantOptionsAndSKUSpecs(t *testing.T) {
	storeID := uuid.NewString()
	productID := uuid.NewString()

	t.Run("Create variant with attributes and SKU specs delegates to Core and returns 201", func(t *testing.T) {
		mock := &variantMockCore{}
		handler := newHandler(mock, &mock.stubCore)

		payload := `{
			"code": "black-xl",
			"status": "active",
			"sku_code": "SKU-BLK-XL",
			"barcode": "6281000999911",
			"attribute_values": [
				{"attribute_id": "color-attr-1", "attribute_value_id": "val-black-1"}
			],
			"weight_grams": 450,
			"dimensions": {"length_mm": 300, "width_mm": 200, "height_mm": 50},
			"price_minor_units": 15000
		}`

		req := httptest.NewRequest(http.MethodPost, "/v1/seller/stores/"+storeID+"/products/"+productID+"/variants", strings.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusCreated {
			t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
		}
		if mock.lastStoreID != storeID {
			t.Errorf("expected storeID %s, got %s", storeID, mock.lastStoreID)
		}
		if mock.lastProductID != productID {
			t.Errorf("expected productID %s, got %s", productID, mock.lastProductID)
		}
		if mock.lastVariantParams.Code != "black-xl" {
			t.Errorf("expected code black-xl, got %s", mock.lastVariantParams.Code)
		}
		if mock.lastVariantParams.SKUCode == nil || *mock.lastVariantParams.SKUCode != "SKU-BLK-XL" {
			t.Errorf("expected sku_code SKU-BLK-XL, got %v", mock.lastVariantParams.SKUCode)
		}
		if mock.lastVariantParams.WeightGrams == nil || *mock.lastVariantParams.WeightGrams != 450 {
			t.Errorf("expected weight_grams 450, got %v", mock.lastVariantParams.WeightGrams)
		}
		if mock.lastVariantParams.Dimensions == nil || *mock.lastVariantParams.Dimensions.LengthMM != 300 {
			t.Errorf("expected length_mm 300, got %v", mock.lastVariantParams.Dimensions)
		}
		if len(mock.lastVariantParams.AttributeValues) != 1 {
			t.Fatalf("expected 1 attribute value, got %d", len(mock.lastVariantParams.AttributeValues))
		}

		var res map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if res["code"] != "black-xl" {
			t.Errorf("expected response code black-xl, got %v", res["code"])
		}
		skuObj, ok := res["sku"].(map[string]any)
		if !ok || skuObj == nil {
			t.Fatalf("expected sku in response, got %v", res["sku"])
		}
		if skuObj["code"] != "SKU-BLK-XL" {
			t.Errorf("expected sku.code SKU-BLK-XL, got %v", skuObj["code"])
		}
	})

	t.Run("Create legacy variant without specs delegates to CreateVariant", func(t *testing.T) {
		mock := &variantMockCore{}
		handler := newHandler(mock, &mock.stubCore)

		payload := `{"code": "simple-var", "status": "active"}`
		req := httptest.NewRequest(http.MethodPost, "/v1/seller/stores/"+storeID+"/products/"+productID+"/variants", strings.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusCreated {
			t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
		}
		if mock.legacyCode != "simple-var" {
			t.Errorf("expected legacyCode simple-var, got %s", mock.legacyCode)
		}
	})
}

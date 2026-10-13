package sellerapi

import (
	"context"
	"net/http"
	"reflect"
	"testing"

	"seller/internal/coreclient"
)

type productRemovalStubCore struct {
	stubCore
	productIDs []string
}

func (s *productRemovalStubCore) RemoveStoreProducts(ctx context.Context, subject, storeID string, productIDs []string) (*coreclient.ProductRemovalResponse, error) {
	s.productIDs = append([]string(nil), productIDs...)
	return &coreclient.ProductRemovalResponse{
		Results: []coreclient.ProductRemovalResult{{ProductID: productIDs[0], Outcome: "removed"}},
	}, nil
}

func TestBulkRemoveStoreProductsRoute(t *testing.T) {
	core := &productRemovalStubCore{}
	handler := newHandler(core, core)

	rec := doRequest(t, handler, http.MethodPost,
		"/v1/seller/stores/store-1/products/bulk-removal",
		`{"product_ids":["product-1"]}`,
	)

	if rec.Code != http.StatusOK {
		t.Fatalf("bulk removal status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}
	if !reflect.DeepEqual(core.productIDs, []string{"product-1"}) {
		t.Fatalf("forwarded product IDs = %v, want [product-1]", core.productIDs)
	}
}

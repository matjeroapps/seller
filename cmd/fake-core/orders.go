package main

// Seller-facing order lifecycle endpoints backed by the storefront order state
// fake-core already maintains. Detail shapes follow the recorded Core contract
// fixtures in internal/coreclient/testdata/p58/order-*.json.

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

// sellerAllowedNextActions is the order lifecycle the seller dashboard can
// drive. A cancelled or completed order is terminal.
func sellerAllowedNextActions(status string) []string {
	switch status {
	case "pending":
		return []string{"confirmed", "cancelled"}
	case "confirmed":
		return []string{"processing", "cancelled"}
	case "processing":
		return []string{"ready_for_shipping", "cancelled"}
	case "ready_for_shipping":
		return []string{"shipped"}
	case "shipped":
		return []string{"completed"}
	default:
		return []string{}
	}
}

func (s *fakeCoreServer) orderBelongsToStore(orderID, storeID string) bool {
	if code, ok := s.orderStores[orderID]; ok {
		return code == storeID
	}
	return false
}

func (s *fakeCoreServer) orderTimeline(order map[string]any) []any {
	timeline, _ := order["timeline"].([]any)
	if timeline == nil {
		timeline = []any{}
	}
	return timeline
}

func (s *fakeCoreServer) handleListOrders(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	status := r.URL.Query().Get("status")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 25
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	orders := []any{}
	for id, order := range s.orders {
		if !s.orderBelongsToStore(id, fakeStoreID) {
			continue
		}
		orderStatus, _ := order["status"].(string)
		if status != "" && orderStatus != status {
			continue
		}
		orders = append(orders, s.sellerOrderSummary(order))
	}
	total := len(orders)
	if offset > len(orders) {
		offset = len(orders)
	}
	end := offset + limit
	if end > len(orders) {
		end = len(orders)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"orders": orders[offset:end],
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// sellerOrderSummary is the list-item shape (SellerOrder in coreclient).
func (s *fakeCoreServer) sellerOrderSummary(order map[string]any) map[string]any {
	items, _ := order["items"].([]any)
	recipientName := ""
	if address, ok := order["address"].(map[string]any); ok {
		recipientName, _ = address["recipient_name"].(string)
	}
	var deadline any
	if v, ok := order["confirmation_deadline_at"]; ok {
		deadline = v
	}
	return map[string]any{
		"id":                       order["id"],
		"order_number":             order["order_number"],
		"status":                   order["status"],
		"currency":                 order["currency_code"],
		"total":                    order["total_minor"],
		"item_count":               len(items),
		"recipient_name":           recipientName,
		"confirmation_deadline_at": deadline,
		"created_at":               order["created_at"],
	}
}

// sellerOrderDetail is the full detail shape (SellerOrderDetail in coreclient).
func (s *fakeCoreServer) sellerOrderDetail(order map[string]any) map[string]any {
	items, _ := order["items"].([]any)
	detailItems := []any{}
	for _, raw := range items {
		item, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		detailItems = append(detailItems, map[string]any{
			"id":           item["id"],
			"product_name": item["product_title_snapshot"],
			"sku_code":     item["sku_code_snapshot"],
			"quantity":     item["quantity"],
			"unit_price":   item["unit_price_minor"],
			"total_price":  item["line_total_minor"],
			"source":       "seller_owned",
		})
	}

	shippingAddress := map[string]any{}
	if address, ok := order["address"].(map[string]any); ok {
		shippingAddress = map[string]any{
			"recipient_name": address["recipient_name"],
			"phone":          address["phone"],
			"address_line_1": address["address_line_1"],
			"address_line_2": address["address_line_2"],
			"city":           address["city"],
			"region":         address["region"],
			"postal_code":    address["postal_code"],
			"country_code":   address["country_code"],
		}
	}

	contactEmail, _ := order["contact_email"].(string)
	if contactEmail == "" {
		contactEmail = "buyer@matjero.test"
	}

	var deadline any
	if v, ok := order["confirmation_deadline_at"]; ok {
		deadline = v
	}

	status, _ := order["status"].(string)
	return map[string]any{
		"id":                       order["id"],
		"order_number":             order["order_number"],
		"status":                   status,
		"currency":                 order["currency_code"],
		"subtotal":                 order["subtotal_minor"],
		"total":                    order["total_minor"],
		"item_count":               len(detailItems),
		"confirmation_deadline_at": deadline,
		"shipping_address":         shippingAddress,
		"contact_email":            contactEmail,
		"items":                    detailItems,
		"timeline":                 s.orderTimeline(order),
		"allowed_next_actions":     sellerAllowedNextActions(status),
		"created_at":               order["created_at"],
		"updated_at":               order["updated_at"],
	}
}

func (s *fakeCoreServer) handleGetOrder(w http.ResponseWriter, orderID string) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	order, ok := s.orders[orderID]
	if !ok || !s.orderBelongsToStore(orderID, fakeStoreID) {
		writeCoreError(w, http.StatusNotFound, "not_found", "order not found")
		return
	}
	writeJSON(w, http.StatusOK, s.sellerOrderDetail(order))
}

func (s *fakeCoreServer) handleTransitionOrder(w http.ResponseWriter, r *http.Request, orderID string) {
	var body struct {
		TargetStatus string  `json:"target_status"`
		Reason       *string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeCoreError(w, http.StatusBadRequest, "invalid_argument", "invalid JSON body")
		return
	}

	s.mu.Lock()
	order, ok := s.orders[orderID]
	if !ok || !s.orderBelongsToStore(orderID, fakeStoreID) {
		s.mu.Unlock()
		writeCoreError(w, http.StatusNotFound, "not_found", "order not found")
		return
	}
	current, _ := order["status"].(string)
	allowed := sellerAllowedNextActions(current)
	permitted := false
	for _, candidate := range allowed {
		if candidate == body.TargetStatus {
			permitted = true
			break
		}
	}
	if !permitted {
		s.mu.Unlock()
		writeCoreError(w, http.StatusUnprocessableEntity, "invalid_order_transition",
			fmt.Sprintf("cannot transition order from %s to %s", current, body.TargetStatus))
		return
	}
	now := time.Now().UTC()
	timeline := s.orderTimeline(order)
	timeline = append(timeline, map[string]any{
		"id":         fmt.Sprintf("tl-%d", s.idSeq.Add(1)),
		"type":       body.TargetStatus,
		"detail":     fmt.Sprintf("status changed from %s to %s", current, body.TargetStatus),
		"created_at": now,
	})
	order["timeline"] = timeline
	order["status"] = body.TargetStatus
	order["updated_at"] = now
	if version, ok := order["aggregate_version"].(int64); ok {
		order["aggregate_version"] = version + 1
	}
	detail := s.sellerOrderDetail(order)
	s.mu.Unlock()

	writeJSON(w, http.StatusOK, detail)
}

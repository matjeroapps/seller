// Command fake-core runs a deterministic test-only Core HTTP server.
//
// It simulates the internal Core contract required by storefront-api (ADR-017)
// without any database or business logic duplication. It is used strictly in E2E
// test suites and CI.
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type storeData struct {
	code             string
	name             string
	domain           string
	market           string
	currencyCode     string
	currencySymbol   string
	currencyMinor    int
	timezone         string
	defaultLocale    string
	supportedLocales []string
	settings         map[string]any
	theme            map[string]any
	draftTheme       map[string]any
	previewToken     string
	revision         int64
	categories       []map[string]any
	products         []map[string]any
}

type fakeCoreServer struct {
	mu                  sync.RWMutex
	expectedTok         string
	unavailable         atomic.Bool
	extraFieldsEnabled  atomic.Bool
	extraFieldEmissions atomic.Uint64
	callCounts          map[string]int64
	stores              map[string]*storeData

	// Test-double OIDC issuer and S3 media storage for the P5.8 seller flow.
	oidc          *oidcAuthority
	s3            *s3Media
	sellerSubject string

	// P5.8 in-memory seller catalog state. Guarded by mu.
	sellerProducts   []*sellerProduct
	sellerLocations  []*sellerLocation
	sellerInventory  []*sellerInventorySnapshot
	mediaIntents     map[string]*mediaIntent
	sellerCategories []map[string]any
	idSeq            atomic.Uint64
	// revisionWatermark guarantees each reset hands out a strictly higher
	// revision than any earlier test run, so stale storefront cache entries
	// (keyed by revision) can never be served after a reset.
	revisionWatermark atomic.Int64

	cartSeq    atomic.Uint64
	sessionSeq atomic.Uint64
	orderSeq   atomic.Uint64
	itemSeq    atomic.Uint64

	carts             map[string]map[string]any
	cartTokens        map[string]map[string]any
	sessions          map[string]map[string]any
	finalizedSessions map[string]string
	orders            map[string]map[string]any
	orderStores       map[string]string
	orderTokens       map[string]string
}

func newServer(token string) *fakeCoreServer {
	s := &fakeCoreServer{
		expectedTok:   token,
		callCounts:    make(map[string]int64),
		stores:        make(map[string]*storeData),
		sellerSubject: "usr_seller_dev",
	}
	s.resetDefaultState()
	return s
}

func (s *fakeCoreServer) resetDefaultState() {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Strictly increase the revision baseline so cached storefront entries
	// keyed by an older (higher) revision can never be served after a reset.
	s.revisionWatermark.Add(100)

	s.unavailable.Store(false)
	s.extraFieldsEnabled.Store(false)
	s.extraFieldEmissions.Store(0)
	s.callCounts = make(map[string]int64)
	s.carts = make(map[string]map[string]any)
	s.cartTokens = make(map[string]map[string]any)
	s.sessions = make(map[string]map[string]any)
	s.finalizedSessions = make(map[string]string)
	s.orders = make(map[string]map[string]any)
	s.orderStores = make(map[string]string)
	s.orderTokens = make(map[string]string)

	// P5.8 seed: one seller with one store, a fulfillment location, and the
	// global categories the product authoring category picker offers.
	seedNow := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	s.sellerProducts = nil
	s.sellerInventory = nil
	s.mediaIntents = make(map[string]*mediaIntent)
	s.sellerLocations = []*sellerLocation{{
		id:        "loc-main",
		code:      "main",
		name:      "Main Warehouse",
		locType:   "warehouse",
		status:    "active",
		createdAt: seedNow,
		updatedAt: seedNow,
	}}
	s.sellerCategories = []map[string]any{
		{"id": "cat-beverages", "parent_category_id": nil, "slug": "beverages", "status": "active", "created_at": seedNow, "updated_at": seedNow},
		{"id": "cat-snacks", "parent_category_id": nil, "slug": "snacks", "status": "active", "created_at": seedNow, "updated_at": seedNow},
	}

	s.stores = map[string]*storeData{
		"store-a.localhost": {
			code:             "store-a",
			name:             "Store A",
			domain:           "store-a.localhost",
			market:           "EG",
			currencyCode:     "EGP",
			currencySymbol:   "EGP",
			currencyMinor:    2,
			timezone:         "Africa/Cairo",
			defaultLocale:    "en",
			supportedLocales: []string{"en", "ar"},
			settings: map[string]any{
				"accent_color": "#10b981",
				"store_marker": "STORE_A_ONLY_MARKER",
			},
			theme: map[string]any{
				"key":                    "matjero-default",
				"version":                "1.0.0",
				"configuration":          map[string]any{"hero": map[string]any{"title": "Store A Title STORE_A_THEME_MARKER <img src=x onerror=\"window.__MATJERO_XSS__='theme'\"><script>window.__MATJERO_XSS__='theme-script'</script>"}},
				"configuration_revision": 1,
			},
			draftTheme: map[string]any{
				"key":                    "matjero-default",
				"version":                "1.0.0",
				"configuration":          map[string]any{"hero": map[string]any{"title": "Store A Draft Title STORE_A_DRAFT_MARKER"}},
				"configuration_revision": 2,
			},
			previewToken: "valid-preview-token-store-a",
			revision:     10 + s.revisionWatermark.Load(),
			categories: []map[string]any{
				{
					"slug":          "electronics",
					"name":          "Electronics",
					"description":   "Store A Electronics",
					"product_count": int64(2),
				},
			},
			products: []map[string]any{
				{
					"slug":         "product-a",
					"name":         "Product A",
					"summary":      "Product A Summary STORE_A_ONLY_MARKER",
					"description":  "Product A Description <script>window.__MATJERO_XSS__='product-script'</script><img src=x onerror=\"window.__MATJERO_XSS__='product-img'\">",
					"availability": "in_stock",
					"price": map[string]any{
						"amount_minor": int64(10000),
						"currency":     "EGP",
					},
					"image": map[string]any{
						"uri":      "/images/product-a.jpg",
						"alt_text": "Product A",
					},
					"images": []map[string]any{
						{"uri": "/images/product-a.jpg", "alt_text": "Product A"},
					},
					"category": map[string]any{
						"slug": "electronics",
						"name": "Electronics",
					},
					"categories": []map[string]any{
						{"slug": "electronics", "name": "Electronics"},
					},
					"variants": []map[string]any{
						{
							"code":         "v-a",
							"availability": "in_stock",
							"skus": []map[string]any{
								{"id": "sku-a-1", "availability": "in_stock"},
							},
						},
					},
					// Forbidden markers inside internal storage state to verify non-leakage
					"_forbidden_supplier_id":    "SUPPLIER_INT_123_FORBIDDEN",
					"_forbidden_wholesale_cost": 5000,
					"_forbidden_margin":         5000,
					"_forbidden_supplier_offer": "OFFER_INT_789_FORBIDDEN",
				},
				{
					"slug":         "shared-slug",
					"name":         "Shared Product",
					"summary":      "Shared Product Store A",
					"description":  "Shared Product Description Store A",
					"availability": "in_stock",
					"price": map[string]any{
						"amount_minor": int64(15000),
						"currency":     "EGP",
					},
					"image": map[string]any{
						"uri":      "/images/shared.jpg",
						"alt_text": "Shared Product",
					},
					"images": []map[string]any{
						{"uri": "/images/shared.jpg", "alt_text": "Shared Product"},
					},
					"category": map[string]any{
						"slug": "electronics",
						"name": "Electronics",
					},
					"categories": []map[string]any{
						{"slug": "electronics", "name": "Electronics"},
					},
					"variants": []map[string]any{
						{
							"code":         "v-shared-a",
							"availability": "in_stock",
							"skus": []map[string]any{
								{"id": "sku-shared-a", "availability": "in_stock"},
							},
						},
					},
				},
			},
		},
		"store-b.localhost": {
			code:             "store-b",
			name:             "Store B",
			domain:           "store-b.localhost",
			market:           "EG",
			currencyCode:     "EGP",
			currencySymbol:   "EGP",
			currencyMinor:    2,
			timezone:         "Africa/Cairo",
			defaultLocale:    "ar",
			supportedLocales: []string{"ar", "en"},
			settings: map[string]any{
				"accent_color": "#3b82f6",
				"store_marker": "STORE_B_ONLY_MARKER",
			},
			theme: map[string]any{
				"key":                    "matjero-default",
				"version":                "1.0.0",
				"configuration":          map[string]any{"hero": map[string]any{"title": "Store B Title STORE_B_THEME_MARKER"}},
				"configuration_revision": 1,
			},
			draftTheme: map[string]any{
				"key":                    "matjero-default",
				"version":                "1.0.0",
				"configuration":          map[string]any{"hero": map[string]any{"title": "Store B Draft Title STORE_B_DRAFT_MARKER"}},
				"configuration_revision": 2,
			},
			previewToken: "valid-preview-token-store-b",
			revision:     20 + s.revisionWatermark.Load(),
			categories: []map[string]any{
				{
					"slug":          "fashion",
					"name":          "Fashion",
					"description":   "Store B Fashion",
					"product_count": int64(2),
				},
			},
			products: []map[string]any{
				{
					"slug":         "product-b",
					"name":         "Product B",
					"summary":      "Product B Summary STORE_B_ONLY_MARKER",
					"description":  "Product B Description",
					"availability": "in_stock",
					"price": map[string]any{
						"amount_minor": int64(25000),
						"currency":     "EGP",
					},
					"image": map[string]any{
						"uri":      "/images/product-b.jpg",
						"alt_text": "Product B",
					},
					"images": []map[string]any{
						{"uri": "/images/product-b.jpg", "alt_text": "Product B"},
					},
					"category": map[string]any{
						"slug": "fashion",
						"name": "Fashion",
					},
					"categories": []map[string]any{
						{"slug": "fashion", "name": "Fashion"},
					},
					"variants": []map[string]any{
						{
							"code":         "v-b",
							"availability": "in_stock",
							"skus": []map[string]any{
								{"id": "sku-b-1", "availability": "in_stock"},
							},
						},
					},
					"_forbidden_supplier_id":    "SUPPLIER_INT_456_FORBIDDEN",
					"_forbidden_wholesale_cost": 12000,
					"_forbidden_margin":         13000,
					"_forbidden_supplier_offer": "OFFER_INT_999_FORBIDDEN",
				},
				{
					"slug":         "shared-slug",
					"name":         "Shared Product",
					"summary":      "Shared Product Store B",
					"description":  "Shared Product Description Store B",
					"availability": "in_stock",
					"price": map[string]any{
						"amount_minor": int64(18000),
						"currency":     "EGP",
					},
					"image": map[string]any{
						"uri":      "/images/shared.jpg",
						"alt_text": "Shared Product",
					},
					"images": []map[string]any{
						{"uri": "/images/shared.jpg", "alt_text": "Shared Product"},
					},
					"category": map[string]any{
						"slug": "fashion",
						"name": "Fashion",
					},
					"categories": []map[string]any{
						{"slug": "fashion", "name": "Fashion"},
					},
					"variants": []map[string]any{
						{
							"code":         "v-shared-b",
							"availability": "in_stock",
							"skus": []map[string]any{
								{"id": "sku-shared-b", "availability": "in_stock"},
							},
						},
					},
				},
			},
		},
	}
}

// unitPriceForSKU resolves the current listing price of a SKU: first from the
// P5.8 seller-authored catalog, then from the seeded storefront products. This
// keeps cart pricing consistent with the published product price.
func (s *fakeCoreServer) unitPriceForSKU(storeCode, skuID string) (int64, bool) {
	price, _, _, found := s.skuInfoFor(storeCode, skuID)
	return price, found
}

// skuInfoFor resolves the price, SKU code and product name for a SKU.
func (s *fakeCoreServer) skuInfoFor(storeCode, skuID string) (int64, string, string, bool) {
	// Seller-authored products (fake-core serves a single seeded store).
	for _, p := range s.sellerProducts {
		for _, v := range p.variants {
			for _, sk := range v.skus {
				if sk.id == skuID {
					name := p.slug
					for _, t := range p.translations {
						if t["locale"] == "en" {
							name, _ = t["name"].(string)
						}
					}
					return p.priceAmount, sk.code, name, true
				}
			}
		}
	}
	// Seeded storefront products.
	if store, ok := s.stores[storeCode]; ok {
		for _, pm := range store.products {
			priceMap, _ := pm["price"].(map[string]any)
			name, _ := pm["name"].(string)
			variants, _ := pm["variants"].([]any)
			for _, rv := range variants {
				v, _ := rv.(map[string]any)
				skus, _ := v["skus"].([]any)
				for _, rs := range skus {
					sku, _ := rs.(map[string]any)
					if sku["id"] == skuID {
						if priceMap != nil {
							if amount, ok := priceMap["amount_minor"].(int64); ok {
								return amount, fmt.Sprint(sku["id"]), name, true
							}
							if amount, ok := priceMap["amount_minor"].(float64); ok {
								return int64(amount), fmt.Sprint(sku["id"]), name, true
							}
						}
					}
				}
			}
		}
	}
	return 0, "", "", false
}

func (s *fakeCoreServer) recordCall(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.callCounts[key]++
}

func (s *fakeCoreServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Public OIDC discovery endpoints (no auth: they are consumed by
	// seller-api's verifier and the browser).
	switch r.URL.Path {
	case "/.well-known/openid-configuration":
		if s.oidc != nil {
			s.oidc.discovery(w, r)
		} else {
			writeCoreError(w, http.StatusServiceUnavailable, "unavailable", "oidc issuer not configured")
		}
		return
	case "/jwks.json":
		if s.oidc != nil {
			s.oidc.jwks(w, r)
		} else {
			writeCoreError(w, http.StatusServiceUnavailable, "unavailable", "oidc issuer not configured")
		}
		return
	}

	// Control plane routes (do not require Core auth tokens)
	if strings.HasPrefix(r.URL.Path, "/test-control/") {
		s.handleControlPlane(w, r)
		return
	}

	if s.unavailable.Load() {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error": map[string]any{
				"code":    "unavailable",
				"message": "fake core is temporarily unavailable",
			},
		})
		return
	}

	// Validate Core Service Auth
	authHeader := r.Header.Get("Authorization")
	serviceHeader := r.Header.Get("X-Matjero-Service")
	if s.expectedTok != "" && authHeader != "Bearer "+s.expectedTok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error": map[string]any{
				"code":    "unauthorized",
				"message": "invalid service token",
			},
		})
		return
	}

	if serviceHeader != "seller" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error": map[string]any{
				"code":    "invalid_service",
				"message": "X-Matjero-Service must be seller",
			},
		})
		return
	}

	host := strings.ToLower(strings.TrimSpace(r.Header.Get("X-Matjero-Storefront-Host")))
	if i := strings.IndexByte(host, ':'); i >= 0 {
		host = host[:i]
	}

	// Seller internal routes (P5.8): host-independent, routed on the subject.
	if strings.HasPrefix(r.URL.Path, "/internal/v1/") && !strings.HasPrefix(r.URL.Path, "/internal/v1/storefront/") {
		s.handleSellerAPI(w, r)
		return
	}

	s.recordCall(r.URL.Path + "|" + host)

	s.mu.RLock()
	store, exists := s.stores[host]
	s.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")

	if !exists {
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error": map[string]any{
				"code":    "storefront_unavailable",
				"message": "storefront not found for host",
			},
		})
		return
	}

	// Route handling
	switch {
	case r.URL.Path == "/internal/v1/storefront/revision":
		_ = json.NewEncoder(w).Encode(map[string]any{
			"revision": store.revision,
		})

	case r.URL.Path == "/internal/v1/storefront/store":
		w.Header().Set("X-Matjero-Storefront-Revision", strconv.FormatInt(store.revision, 10))

		previewToken := strings.TrimSpace(r.Header.Get("X-Matjero-Storefront-Preview"))
		themeToUse := store.theme
		if previewToken != "" {
			if previewToken == store.previewToken {
				themeToUse = store.draftTheme
			} else {
				w.WriteHeader(http.StatusNotFound)
				_ = json.NewEncoder(w).Encode(map[string]any{
					"error": map[string]any{
						"code":    "preview_unavailable",
						"message": "preview token invalid or expired",
					},
				})
				return
			}
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"store": map[string]any{
				"store_code":        store.code,
				"store_name":        store.name,
				"domain":            store.domain,
				"market":            store.market,
				"currency":          map[string]any{"code": store.currencyCode, "symbol": store.currencySymbol, "minor_unit": store.currencyMinor},
				"timezone":          store.timezone,
				"default_locale":    store.defaultLocale,
				"supported_locales": store.supportedLocales,
				"settings":          store.settings,
				"theme":             themeToUse,
			},
		})

	case r.URL.Path == "/internal/v1/storefront/categories":
		w.Header().Set("X-Matjero-Storefront-Revision", strconv.FormatInt(store.revision, 10))
		_ = json.NewEncoder(w).Encode(map[string]any{
			"items": store.categories,
		})

	case strings.HasPrefix(r.URL.Path, "/internal/v1/storefront/categories/"):
		slug := strings.TrimPrefix(r.URL.Path, "/internal/v1/storefront/categories/")
		w.Header().Set("X-Matjero-Storefront-Revision", strconv.FormatInt(store.revision, 10))
		var found map[string]any
		for _, cat := range store.categories {
			if cat["slug"] == slug {
				found = cat
				break
			}
		}
		if found == nil {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"error": map[string]any{
					"code":    "not_found",
					"message": "category not found",
				},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"category": found,
		})

	case r.URL.Path == "/internal/v1/storefront/products" || r.URL.Path == "/internal/v1/storefront/search":
		w.Header().Set("X-Matjero-Storefront-Revision", strconv.FormatInt(store.revision, 10))

		qCategory := r.URL.Query().Get("category")
		qKeyword := strings.ToLower(r.URL.Query().Get("q"))

		filtered := make([]map[string]any, 0)
		for _, p := range store.products {
			cleaned := s.cleanPublicProduct(p)
			if qCategory != "" {
				cat, _ := cleaned["category"].(map[string]any)
				if cat == nil || cat["slug"] != qCategory {
					continue
				}
			}
			if qKeyword != "" {
				name, _ := cleaned["name"].(string)
				summary, _ := cleaned["summary"].(string)
				if !strings.Contains(strings.ToLower(name), qKeyword) && !strings.Contains(strings.ToLower(summary), qKeyword) {
					continue
				}
			}
			filtered = append(filtered, cleaned)
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"items": filtered,
			"pagination": map[string]any{
				"total":  int64(len(filtered)),
				"limit":  20,
				"offset": 0,
			},
		})

	case strings.HasPrefix(r.URL.Path, "/internal/v1/storefront/products/"):
		slug := strings.TrimPrefix(r.URL.Path, "/internal/v1/storefront/products/")
		w.Header().Set("X-Matjero-Storefront-Revision", strconv.FormatInt(store.revision, 10))
		var found map[string]any
		for _, p := range store.products {
			if p["slug"] == slug {
				found = p
				break
			}
		}
		if found == nil {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"error": map[string]any{
					"code":    "not_found",
					"message": "product not found",
				},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"product": s.cleanPublicProduct(found),
		})

	case r.URL.Path == "/internal/v1/storefront/carts" && r.Method == http.MethodPost:
		s.mu.Lock()
		seq := s.cartSeq.Add(1)
		cartID := fmt.Sprintf("cart-%s-%d", store.code, seq)
		cartToken := fmt.Sprintf("token-%s-%d", store.code, seq)
		cart := map[string]any{
			"id":          cartID,
			"status":      "active",
			"market_code": store.market,
			"cart_token":  cartToken,
			"store_code":  store.code,
			"items":       []any{},
		}
		s.carts[cartID] = cart
		s.cartTokens[cartToken] = cart
		s.mu.Unlock()

		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":          cartID,
			"status":      "active",
			"market_code": store.market,
			"cart_token":  cartToken,
			"items":       []any{},
		})

	case r.URL.Path == "/internal/v1/storefront/carts" && r.Method == http.MethodGet:
		cartToken := strings.TrimSpace(r.Header.Get("X-Matjero-Cart-Token"))
		if cartToken == "" {
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": "unauthorized", "message": "unauthorized"}})
			return
		}
		s.mu.RLock()
		cart, ok := s.cartTokens[cartToken]
		s.mu.RUnlock()
		if !ok || cart["store_code"] != store.code {
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": "unauthorized", "message": "unauthorized"}})
			return
		}
		if cart["status"] == "checked_out" {
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": "conflict", "message": "cart is checked out"}})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":          cart["id"],
			"status":      "active",
			"market_code": store.market,
			"items":       cart["items"],
		})

	case r.URL.Path == "/internal/v1/storefront/carts/items" && r.Method == http.MethodPost:
		cartToken := strings.TrimSpace(r.Header.Get("X-Matjero-Cart-Token"))
		s.mu.Lock()
		var cart map[string]any
		if cartToken == "" {
			seq := s.cartSeq.Add(1)
			cartID := fmt.Sprintf("cart-%s-%d", store.code, seq)
			cartToken = fmt.Sprintf("token-%s-%d", store.code, seq)
			cart = map[string]any{
				"id":          cartID,
				"status":      "active",
				"market_code": store.market,
				"cart_token":  cartToken,
				"store_code":  store.code,
				"items":       []any{},
			}
			s.carts[cartID] = cart
			s.cartTokens[cartToken] = cart
		} else {
			var ok bool
			cart, ok = s.cartTokens[cartToken]
			if !ok || cart["store_code"] != store.code {
				s.mu.Unlock()
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": "unauthorized", "message": "unauthorized"}})
				return
			}
			if cart["status"] == "checked_out" {
				s.mu.Unlock()
				w.WriteHeader(http.StatusConflict)
				_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": "conflict", "message": "cart is checked out"}})
				return
			}
		}

		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		skuID, _ := body["sku_id"].(string)
		qtyFloat, _ := body["quantity"].(float64)
		qty := int64(qtyFloat)
		if qty <= 0 {
			qty = 1
		}
		itemID := fmt.Sprintf("item-%d", s.itemSeq.Add(1))
		unitPrice, found := s.unitPriceForSKU(store.code, skuID)
		if !found {
			unitPrice = 1000
		}
		newItem := map[string]any{
			"id":                        itemID,
			"sku_id":                    skuID,
			"quantity":                  qty,
			"expected_unit_price_minor": unitPrice,
			"expected_currency_code":    store.currencyCode,
		}
		items, _ := cart["items"].([]any)
		items = append(items, newItem)
		cart["items"] = items
		s.mu.Unlock()

		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":          cart["id"],
			"status":      "active",
			"market_code": store.market,
			"items":       items,
		})

	case strings.HasPrefix(r.URL.Path, "/internal/v1/storefront/carts/items/") && (r.Method == http.MethodPatch || r.Method == http.MethodDelete):
		cartToken := strings.TrimSpace(r.Header.Get("X-Matjero-Cart-Token"))
		s.mu.RLock()
		cart, ok := s.cartTokens[cartToken]
		s.mu.RUnlock()
		if !ok || cart["store_code"] != store.code {
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": "unauthorized", "message": "unauthorized"}})
			return
		}
		if cart["status"] == "checked_out" {
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": "conflict", "message": "cart is checked out"}})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":          cart["id"],
			"status":      "active",
			"market_code": store.market,
			"items":       cart["items"],
		})

	case r.URL.Path == "/internal/v1/storefront/checkout-sessions" && r.Method == http.MethodPost:
		cartToken := strings.TrimSpace(r.Header.Get("X-Matjero-Cart-Token"))
		s.mu.Lock()
		cart, ok := s.cartTokens[cartToken]
		if !ok || cart["store_code"] != store.code {
			s.mu.Unlock()
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": "validation_error", "message": "active cart required"}})
			return
		}
		if cart["status"] == "checked_out" {
			s.mu.Unlock()
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": "conflict", "message": "cart is checked out"}})
			return
		}
		seq := s.sessionSeq.Add(1)
		sessionID := fmt.Sprintf("session-%s-%d", store.code, seq)
		guestToken := fmt.Sprintf("guest-token-%s-%d", store.code, seq)
		sess := map[string]any{
			"id":                       sessionID,
			"cart_id":                  cart["id"],
			"status":                   "open",
			"expires_at":               "2026-12-31T23:59:59Z",
			"guest_order_access_token": guestToken,
			"store_code":               store.code,
		}
		s.sessions[sessionID] = sess
		s.mu.Unlock()

		_ = json.NewEncoder(w).Encode(sess)

	case strings.HasPrefix(r.URL.Path, "/internal/v1/storefront/checkout-sessions/") && strings.HasSuffix(r.URL.Path, "/finalize"):
		parts := strings.Split(r.URL.Path, "/")
		sessionID := parts[len(parts)-2]

		s.mu.Lock()
		sess, ok := s.sessions[sessionID]
		if !ok || sess["store_code"] != store.code {
			s.mu.Unlock()
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": "not_found", "message": "session not found"}})
			return
		}

		if existingOrderID, finalized := s.finalizedSessions[sessionID]; finalized {
			existingOrder := s.orders[existingOrderID]
			s.mu.Unlock()
			_ = json.NewEncoder(w).Encode(existingOrder)
			return
		}

		var req struct {
			ShippingAddress struct {
				RecipientName string  `json:"recipient_name"`
				Phone         *string `json:"phone"`
				AddressLine1  string  `json:"address_line_1"`
				AddressLine2  *string `json:"address_line_2"`
				City          string  `json:"city"`
				Region        *string `json:"region"`
				PostalCode    *string `json:"postal_code"`
				CountryCode   string  `json:"country_code"`
			} `json:"shipping_address"`
			ContactEmail string `json:"contact_email"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)

		contactEmail := req.ContactEmail
		if contactEmail == "" {
			contactEmail = "buyer@matjero.test"
		}

		seq := s.orderSeq.Add(1)
		orderID := fmt.Sprintf("ord-%s-%d", store.code, seq)
		orderNum := fmt.Sprintf("#10000%d", seq)
		guestToken := sess["guest_order_access_token"].(string)

		recName := req.ShippingAddress.RecipientName
		if recName == "" {
			recName = "Jane Doe"
		}
		addrLine1 := req.ShippingAddress.AddressLine1
		if addrLine1 == "" {
			addrLine1 = "123 Main St"
		}
		city := req.ShippingAddress.City
		if city == "" {
			city = "Cairo"
		}
		country := req.ShippingAddress.CountryCode
		if country == "" {
			country = "EG"
		}

		addrMap := map[string]any{
			"id":             fmt.Sprintf("addr-%d", seq),
			"order_id":       orderID,
			"address_type":   "shipping",
			"recipient_name": recName,
			"phone":          req.ShippingAddress.Phone,
			"address_line_1": addrLine1,
			"address_line_2": req.ShippingAddress.AddressLine2,
			"city":           city,
			"region":         req.ShippingAddress.Region,
			"postal_code":    req.ShippingAddress.PostalCode,
			"country_code":   country,
			"created_at":     "2026-09-05T12:00:00Z",
		}

		// Compute the order from the cart items, priced from the catalog.
		var subtotalMinor int64
		orderItems := []any{}
		if cartID, ok := sess["cart_id"].(string); ok {
			if cart, ok := s.carts[cartID]; ok {
				cartItems, _ := cart["items"].([]any)
				for _, ri := range cartItems {
					item, _ := ri.(map[string]any)
					skuID, _ := item["sku_id"].(string)
					qty, _ := item["quantity"].(int64)
					if qty <= 0 {
						qty = 1
					}
					var unitPrice int64
					if up, ok := item["expected_unit_price_minor"].(int64); ok {
						unitPrice = up
					}
					price, skuCode, productName, _ := s.skuInfoFor(store.code, skuID)
					_ = price
					if productName == "" {
						productName = "Product"
					}
					lineTotal := unitPrice * qty
					subtotalMinor += lineTotal
					orderItems = append(orderItems, map[string]any{
						"id":                     fmt.Sprintf("ord-item-%d", s.itemSeq.Add(1)),
						"order_id":               orderID,
						"product_title_snapshot": productName,
						"sku_code_snapshot":      skuCode,
						"sku_id":                 skuID,
						"unit_price_minor":       unitPrice,
						"currency_code":          store.currencyCode,
						"quantity":               qty,
						"line_total_minor":       lineTotal,
						"created_at":             "2026-09-05T12:00:00Z",
					})
				}
			}
		}
		if len(orderItems) == 0 {
			subtotalMinor = 1000
			orderItems = append(orderItems, map[string]any{
				"id":                     fmt.Sprintf("ord-item-%d", s.itemSeq.Add(1)),
				"order_id":               orderID,
				"product_title_snapshot": "Test Product",
				"sku_code_snapshot":      "SKU-1",
				"unit_price_minor":       int64(1000),
				"currency_code":          store.currencyCode,
				"quantity":               int64(1),
				"line_total_minor":       int64(1000),
				"created_at":             "2026-09-05T12:00:00Z",
			})
		}

		orderMap := map[string]any{
			"id":                       orderID,
			"order_number":             orderNum,
			"store_id":                 store.code,
			"market_code":              store.market,
			"checkout_session_id":      sessionID,
			"status":                   "pending",
			"currency_code":            store.currencyCode,
			"subtotal_minor":           subtotalMinor,
			"total_minor":              subtotalMinor,
			"confirmation_deadline_at": "2026-12-31T23:59:59Z",
			"aggregate_version":        int64(1),
			"created_at":               "2026-09-05T12:00:00Z",
			"updated_at":               "2026-09-05T12:00:00Z",
			"contact_email":            contactEmail,
			"timeline": []any{
				map[string]any{
					"id":         fmt.Sprintf("tl-%d", s.idSeq.Add(1)),
					"type":       "pending",
					"detail":     "",
					"created_at": "2026-09-05T12:00:00Z",
				},
			},
			"items":   orderItems,
			"address": addrMap,
		}

		if cartID, ok := sess["cart_id"].(string); ok {
			if cart, ok := s.carts[cartID]; ok {
				cart["status"] = "checked_out"
			}
		}

		s.orders[orderID] = orderMap
		s.finalizedSessions[sessionID] = orderID
		s.orderStores[orderID] = store.code
		s.orderTokens[orderID] = guestToken
		s.mu.Unlock()

		_ = json.NewEncoder(w).Encode(orderMap)

	case strings.HasPrefix(r.URL.Path, "/internal/v1/storefront/orders/") && strings.HasSuffix(r.URL.Path, "/cancel"):
		orderID := strings.TrimPrefix(r.URL.Path, "/internal/v1/storefront/orders/")
		orderID = strings.TrimSuffix(orderID, "/cancel")

		s.mu.Lock()
		expectedStore, okStore := s.orderStores[orderID]
		expectedToken, okToken := s.orderTokens[orderID]
		orderMap, okOrder := s.orders[orderID]
		s.mu.Unlock()

		if !okStore || expectedStore != store.code || !okOrder {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": "not_found", "message": "not found"}})
			return
		}

		guestToken := strings.TrimSpace(r.Header.Get("X-Matjero-Guest-Order-Token"))
		if guestToken == "" || !okToken || expectedToken != guestToken {
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": "unauthorized", "message": "unauthorized"}})
			return
		}

		s.mu.Lock()
		orderMap["status"] = "cancelled"
		orderMap["aggregate_version"] = int64(2)
		orderMap["updated_at"] = "2026-09-05T12:05:00Z"
		s.mu.Unlock()

		_ = json.NewEncoder(w).Encode(orderMap)

	case strings.HasPrefix(r.URL.Path, "/internal/v1/storefront/orders/"):
		orderID := strings.TrimPrefix(r.URL.Path, "/internal/v1/storefront/orders/")

		s.mu.RLock()
		expectedStore, okStore := s.orderStores[orderID]
		expectedToken, okToken := s.orderTokens[orderID]
		orderMap, okOrder := s.orders[orderID]
		s.mu.RUnlock()

		if !okStore || expectedStore != store.code || !okOrder {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": "not_found", "message": "not found"}})
			return
		}

		guestToken := strings.TrimSpace(r.Header.Get("X-Matjero-Guest-Order-Token"))
		if guestToken == "" || !okToken || expectedToken != guestToken {
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": "unauthorized", "message": "unauthorized"}})
			return
		}

		_ = json.NewEncoder(w).Encode(orderMap)

	default:
		w.WriteHeader(http.StatusNotFound)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error": map[string]any{
				"code":    "not_found",
				"message": "endpoint not found",
			},
		})
	}
}

func (s *fakeCoreServer) cleanPublicProduct(p map[string]any) map[string]any {
	out := make(map[string]any)
	for k, v := range p {
		if strings.HasPrefix(k, "_forbidden") {
			continue
		}
		out[k] = v
	}
	if s.extraFieldsEnabled.Load() {
		s.extraFieldEmissions.Add(1)
		out["supplier_id"] = "SUPPLIER_FORBIDDEN_MARKER"
		out["supplier_contact"] = "SUPPLIER_CONTACT_FORBIDDEN"
		out["supplier_offer_id"] = "OFFER_FORBIDDEN_MARKER"
		out["wholesale_price_minor"] = 5000
		out["supplier_margin_minor"] = 5000
	}
	return out
}

func (s *fakeCoreServer) handleControlPlane(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	switch r.URL.Path {
	case "/test-control/calls":
		s.mu.RLock()
		defer s.mu.RUnlock()
		_ = json.NewEncoder(w).Encode(map[string]any{
			"calls": s.callCounts,
		})

	case "/test-control/calls/reset":
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		s.mu.Lock()
		s.callCounts = make(map[string]int64)
		s.mu.Unlock()
		_ = json.NewEncoder(w).Encode(map[string]any{"status": "calls_reset_complete"})

	case "/test-control/extra-field-emissions":
		_ = json.NewEncoder(w).Encode(map[string]any{
			"emissions": s.extraFieldEmissions.Load(),
		})

	case "/test-control/extra-fields":
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			Enabled bool `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		s.extraFieldsEnabled.Store(req.Enabled)
		_ = json.NewEncoder(w).Encode(map[string]any{"enabled": s.extraFieldsEnabled.Load()})

	case "/test-control/revision":
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			Host     string `json:"host"`
			Revision int64  `json:"revision"`
			Bump     bool   `json:"bump"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		s.mu.Lock()
		if store, ok := s.stores[req.Host]; ok {
			if req.Bump {
				store.revision++
			} else if req.Revision > 0 {
				store.revision = req.Revision
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"host":     req.Host,
				"revision": store.revision,
			})
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
		s.mu.Unlock()

	case "/test-control/product":
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			Host  string `json:"host"`
			Slug  string `json:"slug"`
			Field string `json:"field"`
			Value any    `json:"value"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		s.mu.Lock()
		if store, ok := s.stores[req.Host]; ok {
			for _, p := range store.products {
				if p["slug"] == req.Slug {
					p[req.Field] = req.Value
				}
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"status": "updated"})
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
		s.mu.Unlock()

	case "/test-control/token":
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if s.oidc == nil {
			writeCoreError(w, http.StatusServiceUnavailable, "unavailable", "oidc issuer not configured")
			return
		}
		var req struct {
			Subject string `json:"subject"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		token, err := s.oidc.mintToken(req.Subject)
		if err != nil {
			writeCoreError(w, http.StatusInternalServerError, "internal_error", fmt.Sprintf("mint token: %v", err))
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"token":        token,
			"access_token": token,
			"token_type":   "Bearer",
			"expires_in":   5 * 3600,
			"subject":      req.Subject,
		})

	case "/test-control/status":
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			Unavailable bool `json:"unavailable"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		s.unavailable.Store(req.Unavailable)
		_ = json.NewEncoder(w).Encode(map[string]any{"unavailable": s.unavailable.Load()})

	case "/test-control/reset":
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		s.resetDefaultState()
		_ = json.NewEncoder(w).Encode(map[string]any{"status": "reset_complete"})

	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

func main() {
	port := os.Getenv("FAKE_CORE_PORT")
	if port == "" {
		port = "18080"
	}
	token := os.Getenv("CORE_API_TOKEN")

	issuer := strings.TrimRight(os.Getenv("FAKE_CORE_ISSUER_URL"), "/")
	if issuer == "" {
		issuer = "http://127.0.0.1:" + port
	}
	audience := os.Getenv("FAKE_CORE_OIDC_AUDIENCE")
	if audience == "" {
		audience = "seller-api"
	}

	authority, err := newOIDCAuthority(issuer, audience)
	if err != nil {
		log.Fatalf("Fake Core OIDC authority failed: %v", err)
	}

	subject := os.Getenv("FAKE_CORE_SELLER_SUBJECT")
	if subject == "" {
		subject = "usr_seller_dev"
	}

	server := newServer(token)
	server.oidc = authority
	server.s3 = newS3Media()
	server.sellerSubject = subject

	logS3Config(server.s3)
	log.Printf("Fake Core OIDC issuer: %s (audience %s)", issuer, audience)
	addr := "127.0.0.1:" + port
	log.Printf("Fake Core listening on http://%s", addr)
	if err := http.ListenAndServe(addr, server); err != nil {
		log.Fatalf("Fake Core failed: %v", err)
	}
}

// Command fake-core runs a deterministic test-only Core HTTP server.
//
// It simulates the internal Core contract required by storefront-api (ADR-017)
// without any database or business logic duplication. It is used strictly in E2E
// test suites and CI.
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
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
	mu                 sync.RWMutex
	expectedTok        string
	unavailable        atomic.Bool
	extraFieldsEnabled atomic.Bool
	callCounts         map[string]int64
	stores             map[string]*storeData
}

func newServer(token string) *fakeCoreServer {
	s := &fakeCoreServer{
		expectedTok: token,
		callCounts:  make(map[string]int64),
		stores:      make(map[string]*storeData),
	}
	s.resetDefaultState()
	return s
}

func (s *fakeCoreServer) resetDefaultState() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.unavailable.Store(false)
	s.extraFieldsEnabled.Store(false)
	s.callCounts = make(map[string]int64)
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
			revision:     10,
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
			revision:     20,
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

func (s *fakeCoreServer) recordCall(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.callCounts[key]++
}

func (s *fakeCoreServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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

	server := newServer(token)
	addr := "127.0.0.1:" + port
	log.Printf("Fake Core listening on http://%s", addr)
	if err := http.ListenAndServe(addr, server); err != nil {
		log.Fatalf("Fake Core failed: %v", err)
	}
}

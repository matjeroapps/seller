package actorapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"seller/internal/auth"
	"seller/internal/coreclient"
	"seller/internal/i18n"
	"seller/internal/markets"
)

func fakeConsoleWorkspaces() []coreclient.MerchantWorkspace {
	return []coreclient.MerchantWorkspace{
		{
			MerchantID:     "11111111-1111-1111-1111-111111111111",
			MerchantCode:   "M-1",
			LegalName:      "Merchant One",
			MerchantStatus: "active",
			Membership: coreclient.MerchantWorkspaceMembership{
				ID:          "m-1",
				Status:      "active",
				Permissions: []string{"retail.orders.manage"},
			},
			Capabilities: &coreclient.MerchantWorkspaceCapabilities{
				Retail: &coreclient.MerchantWorkspaceCapability{Status: "active"},
				Supply: &coreclient.MerchantWorkspaceCapability{Status: "inactive"},
			},
			Stores: []coreclient.MerchantWorkspaceStore{{
				ID: "store-1", Code: "ST-1", Name: "Store One", Status: "active", MarketCode: "EG",
			}},
			PlanSummary:    &coreclient.MerchantWorkspacePlanSummary{State: "NO_PLAN_MODEL"},
			PendingActions: &coreclient.MerchantWorkspacePendingActions{OpenReviewCases: 2},
		},
		{
			// Invited membership: identity only, no operable details.
			MerchantID:     "22222222-2222-2222-2222-222222222222",
			MerchantCode:   "M-2",
			LegalName:      "Merchant Two",
			MerchantStatus: "active",
			Membership: coreclient.MerchantWorkspaceMembership{
				ID:     "m-2",
				Status: "invited",
			},
			Stores: []coreclient.MerchantWorkspaceStore{},
		},
	}
}

type fakeConsoleService struct {
	bootstrap *coreclient.MerchantBootstrap
	err       error
}

func (f fakeConsoleService) GetMerchantBootstrap(ctx context.Context, subject string) (*coreclient.MerchantBootstrap, error) {
	return f.bootstrap, f.err
}

func newConsoleRouter(t *testing.T, console MerchantConsoleService) http.Handler {
	t.Helper()
	return NewRouter(Config{
		AppName:      "Seller API",
		Actor:        "seller",
		RequireAuth:  true,
		AllowedRoles: []string{auth.RoleSellerOwner},
		Console:      console,
	}, fakeMarketService{markets: []markets.Market{sampleMarket()}}, fakeVerifier{
		principal: auth.Principal{
			Subject: "user-console",
			Roles:   []string{auth.RoleSellerOwner},
		},
	})
}

// TestBootstrapAdditiveExtensionCompatibility proves the extension is additive:
// every legacy field is still present and populated for a seller principal.
func TestBootstrapAdditiveExtensionCompatibility(t *testing.T) {
	router := newConsoleRouter(t, fakeConsoleService{bootstrap: &coreclient.MerchantBootstrap{
		Subject:    "user-console",
		Workspaces: fakeConsoleWorkspaces(),
		Meta:       coreclient.MerchantBootstrapMeta{ContractVersion: "1"},
	}})

	req := httptest.NewRequest(http.MethodGet, "/v1/bootstrap?locale=ar", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", resp.Code, resp.Body.String())
	}
	var payload struct {
		App              string           `json:"app"`
		Actor            string           `json:"actor"`
		Locale           string           `json:"locale"`
		Direction        string           `json:"direction"`
		SupportedLocales []string         `json:"supported_locales"`
		Principal        *auth.Principal  `json:"principal"`
		Markets          []markets.Market `json:"markets"`
		MerchantConsole  *struct {
			ContractVersion string                         `json:"contract_version"`
			Workspaces      []coreclient.MerchantWorkspace `json:"workspaces"`
			Selected        *string                        `json:"selected_merchant_id,omitempty"`
		} `json:"merchant_console"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if payload.App != "Seller API" || payload.Actor != "seller" {
		t.Errorf("legacy fields changed: %+v", payload)
	}
	if payload.Locale != string(i18n.LocaleArabic) || payload.Direction != "rtl" {
		t.Errorf("locale fields changed: %s/%s", payload.Locale, payload.Direction)
	}
	if payload.Principal == nil || payload.Principal.Subject != "user-console" {
		t.Errorf("principal changed: %+v", payload.Principal)
	}
	if len(payload.Markets) != 1 {
		t.Errorf("markets changed: %+v", payload.Markets)
	}
	if payload.MerchantConsole == nil {
		t.Fatal("expected merchant_console block")
	}
	if payload.MerchantConsole.ContractVersion != "1" {
		t.Errorf("contract version = %q", payload.MerchantConsole.ContractVersion)
	}
	if len(payload.MerchantConsole.Workspaces) != 2 {
		t.Errorf("expected 2 workspaces, got %d", len(payload.MerchantConsole.Workspaces))
	}
	// The invited workspace exposes no operable details.
	for _, ws := range payload.MerchantConsole.Workspaces {
		if ws.Membership.Status == "invited" && (ws.Capabilities != nil || len(ws.Stores) != 0) {
			t.Errorf("invited workspace leaked operable details: %+v", ws)
		}
	}
	if payload.MerchantConsole.Selected != nil {
		t.Errorf("no selection requested; selected must be absent, got %q", *payload.MerchantConsole.Selected)
	}
}

func TestBootstrapWithoutConsoleIntegrationOmitsBlock(t *testing.T) {
	router := newConsoleRouter(t, nil)

	req := httptest.NewRequest(http.MethodGet, "/v1/bootstrap", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("status = %d", resp.Code)
	}
	var raw map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if _, present := raw["merchant_console"]; present {
		t.Errorf("merchant_console must be absent without console integration")
	}
	if raw["app"] != "Seller API" {
		t.Errorf("legacy bootstrap broken: %+v", raw)
	}
}

func TestBootstrapEmptyWorkspaceListIsValid(t *testing.T) {
	router := newConsoleRouter(t, fakeConsoleService{bootstrap: &coreclient.MerchantBootstrap{
		Subject:    "user-console",
		Workspaces: []coreclient.MerchantWorkspace{},
		Meta:       coreclient.MerchantBootstrapMeta{ContractVersion: "1"},
	}})

	req := httptest.NewRequest(http.MethodGet, "/v1/bootstrap", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("empty workspaces must be a valid response, got %d", resp.Code)
	}
	var payload struct {
		MerchantConsole *struct {
			Workspaces []coreclient.MerchantWorkspace `json:"workspaces"`
		} `json:"merchant_console"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if payload.MerchantConsole == nil || len(payload.MerchantConsole.Workspaces) != 0 {
		t.Errorf("expected explicit empty workspaces, got %+v", payload.MerchantConsole)
	}
}

func TestBootstrapSelectedWorkspaceEchoOnlyAfterValidation(t *testing.T) {
	workspaces := fakeConsoleWorkspaces()
	router := newConsoleRouter(t, fakeConsoleService{bootstrap: &coreclient.MerchantBootstrap{
		Subject:    "user-console",
		Workspaces: workspaces,
		Meta:       coreclient.MerchantBootstrapMeta{ContractVersion: "1"},
	}})

	// A valid, operable selection is echoed.
	req := httptest.NewRequest(http.MethodGet, "/v1/bootstrap?merchant_id="+workspaces[0].MerchantID, nil)
	req.Header.Set("Authorization", "Bearer test-token")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	if resp.Code != http.StatusOK {
		t.Fatalf("valid selection: status = %d", resp.Code)
	}
	var payload struct {
		MerchantConsole *struct {
			Selected *string `json:"selected_merchant_id,omitempty"`
		} `json:"merchant_console"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if payload.MerchantConsole == nil || payload.MerchantConsole.Selected == nil || *payload.MerchantConsole.Selected != workspaces[0].MerchantID {
		t.Errorf("expected selected echo, got %+v", payload.MerchantConsole)
	}

	// A non-operable (invited) selection is denied.
	req = httptest.NewRequest(http.MethodGet, "/v1/bootstrap?merchant_id="+workspaces[1].MerchantID, nil)
	req.Header.Set("Authorization", "Bearer test-token")
	resp = httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	if resp.Code != http.StatusForbidden {
		t.Errorf("invited workspace selection: expected 403, got %d", resp.Code)
	}

	// An unknown merchant is denied — never guessed or defaulted.
	req = httptest.NewRequest(http.MethodGet, "/v1/bootstrap?merchant_id=99999999-9999-9999-9999-999999999999", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	resp = httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	if resp.Code != http.StatusForbidden {
		t.Errorf("unknown workspace selection: expected 403, got %d", resp.Code)
	}
}

func TestBootstrapConsoleFailureIsStructured(t *testing.T) {
	router := newConsoleRouter(t, fakeConsoleService{err: errors.New("core unreachable")})

	req := httptest.NewRequest(http.MethodGet, "/v1/bootstrap", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", resp.Code)
	}
	var errResp struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&errResp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if errResp.Error.Code != "bootstrap_unavailable" {
		t.Errorf("expected structured bootstrap_unavailable, got %+v", errResp)
	}
}

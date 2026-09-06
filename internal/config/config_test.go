package config

import "testing"

func TestLoadDefaults(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("HTTP_ADDR", "")
	t.Setenv("SHUTDOWN_TIMEOUT_SECONDS", "")

	cfg, err := Load("admin-api")
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}

	if cfg.ServiceName != "admin-api" {
		t.Fatalf("service name = %q", cfg.ServiceName)
	}
	if cfg.HTTPAddr != ":8080" {
		t.Fatalf("HTTPAddr = %q", cfg.HTTPAddr)
	}
	if cfg.ZitadelAudience != "admin-api" {
		t.Fatalf("ZitadelAudience = %q", cfg.ZitadelAudience)
	}
}

func TestLoadRejectsInvalidShutdownTimeout(t *testing.T) {
	t.Setenv("SHUTDOWN_TIMEOUT_SECONDS", "nope")

	if _, err := Load("admin-api"); err == nil {
		t.Fatal("expected invalid timeout error")
	}
}

func TestProductionConfigValidation(t *testing.T) {
	t.Setenv("APP_ENV", "production")

	// Missing production core api base url triggers fail-fast error
	if _, err := Load("seller-api"); err == nil {
		t.Fatal("expected error for production config with default localhost core url, got nil")
	}

	// Valid production configuration succeeds
	t.Setenv("CORE_API_BASE_URL", "http://core-api.internal:8080")
	t.Setenv("CORE_API_TOKEN", "secret-seller-token")
	t.Setenv("ZITADEL_ISSUER", "https://auth.matjero.com")
	t.Setenv("STOREFRONT_COOKIE_SECURE", "true")

	cfg, err := Load("seller-api")
	if err != nil {
		t.Fatalf("expected valid production config load, got: %v", err)
	}
	if cfg.Environment != "production" {
		t.Fatalf("Environment = %q, want production", cfg.Environment)
	}
}

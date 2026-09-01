package storefrontapi

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// coreModule is the module whose migrations define the commerce schema. Migrations
// are centralized in Core, so integration tests read them from the resolved module
// directory rather than duplicating SQL here.
const coreModule = "github.com/matjeroapps/core"

var coreMigrations = []string{
	"000002_market_reference_data",
	"000003_commerce_domain_schema",
	"000004_admin_supplier_seller_platforms",
	"000005_store_domain_lifecycle",
	"000006_store_domain_integrity",
	"000007_theme_engine_schema",
}

var nonIdentifier = regexp.MustCompile(`[^a-z0-9_]+`)

// openTestDB provisions an isolated schema on the test database and applies the
// Core migrations to it, so parallel packages cannot collide.
//
// When TEST_DATABASE_URL is set the database is treated as required and an
// unreachable server fails the test: CI configures it deliberately, and a silent
// skip there would let cross-store isolation regressions pass unnoticed. Local
// runs without it fall back to the compose default and skip when absent.
func openTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	required := dsn != ""
	if dsn == "" {
		dsn = "postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable"
	}
	ctx := context.Background()

	adminPool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		unavailable(t, required, err)
	}
	if err := adminPool.Ping(ctx); err != nil {
		adminPool.Close()
		unavailable(t, required, err)
	}

	schema := schemaName(t.Name())
	quoted := pgx.Identifier{schema}.Sanitize()
	if _, err := adminPool.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS `+quoted); err != nil {
		adminPool.Close()
		t.Fatalf("create schema %s: %v", schema, err)
	}
	// Concurrent CREATE EXTENSION across packages sharing one database can race;
	// tolerate the duplicate as long as the extension ends up present.
	if _, err := adminPool.Exec(ctx, `CREATE EXTENSION IF NOT EXISTS pgcrypto`); err != nil {
		var exists bool
		if qErr := adminPool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')`).Scan(&exists); qErr != nil || !exists {
			adminPool.Close()
			t.Fatalf("ensure pgcrypto: %v", err)
		}
	}

	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		adminPool.Close()
		t.Fatalf("parse dsn: %v", err)
	}
	if cfg.ConnConfig.RuntimeParams == nil {
		cfg.ConnConfig.RuntimeParams = map[string]string{}
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		adminPool.Close()
		t.Fatalf("open isolated pool: %v", err)
	}
	t.Cleanup(func() {
		pool.Close()
		if _, err := adminPool.Exec(ctx, `DROP SCHEMA IF EXISTS `+quoted+` CASCADE`); err != nil {
			t.Logf("drop schema %s: %v", schema, err)
		}
		adminPool.Close()
	})

	migrationDir := coreMigrationDir(t)
	for _, name := range coreMigrations {
		body, err := os.ReadFile(filepath.Join(migrationDir, name+".up.sql"))
		if err != nil {
			t.Fatalf("read migration %s: %v", name, err)
		}
		if _, err := pool.Exec(ctx, string(body)); err != nil {
			t.Fatalf("apply migration %s: %v", name, err)
		}
	}
	return pool
}

func coreMigrationDir(t *testing.T) string {
	t.Helper()
	out, err := exec.Command("go", "list", "-m", "-f", "{{.Dir}}", coreModule).Output()
	if err != nil {
		t.Fatalf("resolve core module directory: %v", err)
	}
	dir := strings.TrimSpace(string(out))
	if dir == "" {
		t.Fatal("core module directory is empty")
	}
	return filepath.Join(dir, "migrations")
}

func unavailable(t *testing.T, required bool, err error) {
	t.Helper()
	if required {
		t.Fatalf("postgres unavailable but TEST_DATABASE_URL is set: %v", err)
	}
	t.Skipf("postgres unavailable: %v", err)
}

func schemaName(name string) string {
	base := nonIdentifier.ReplaceAllString(strings.ToLower(name), "_")
	base = strings.Trim(base, "_")
	if base == "" {
		base = "storefrontapi"
	}
	return fmt.Sprintf("%s_%d", base, time.Now().UnixNano())
}

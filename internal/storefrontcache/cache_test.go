package storefrontcache

import (
	"context"
	"testing"
	"time"

	"github.com/matjeroapps/seller/internal/coreclient"
	"github.com/matjeroapps/seller/internal/i18n"
)

// mockStore is a simple in-memory store for testing.
type mockStore struct {
	data map[string][]byte
	err  error
}

func (m *mockStore) Get(ctx context.Context, key string) ([]byte, bool, error) {
	if m.err != nil {
		return nil, false, m.err
	}
	value, found := m.data[key]
	return value, found, nil
}

func (m *mockStore) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	if m.err != nil {
		return m.err
	}
	if m.data == nil {
		m.data = make(map[string][]byte)
	}
	m.data[key] = value
	return nil
}

// TestNewValidStore validates that New accepts a valid store.
func TestNewValidStore(t *testing.T) {
	store := &mockStore{data: make(map[string][]byte)}
	cache, err := New(store, Config{})
	if err != nil {
		t.Fatalf("New() with valid store: %v", err)
	}
	if cache == nil {
		t.Fatal("New() returned nil cache")
	}
}

// TestNewNilStore validates that New rejects a nil store.
func TestNewNilStore(t *testing.T) {
	_, err := New(nil, Config{})
	if err == nil {
		t.Fatal("New() with nil store: want error, got nil")
	}
}

// TestNewDefaultConfig validates that New applies default configuration.
func TestNewDefaultConfig(t *testing.T) {
	store := &mockStore{data: make(map[string][]byte)}
	cache, err := New(store, Config{})
	if err != nil {
		t.Fatalf("New(): %v", err)
	}

	if cache.ttl != defaultTTL {
		t.Errorf("ttl = %v, want %v", cache.ttl, defaultTTL)
	}
	if cache.maxPayloadBytes != defaultMaxPayloadBytes {
		t.Errorf("maxPayloadBytes = %d, want %d", cache.maxPayloadBytes, defaultMaxPayloadBytes)
	}
}

// TestLookupHit validates that Lookup returns a cached entry.
func TestLookupHit(t *testing.T) {
	id := Identity{
		Host:     "host.test",
		Locale:   i18n.Locale("en"),
		Resource: ResourceStore,
	}
	payload := []byte(`{"name":"Store"}`)
	cacheKey := Key(id, 1)

	store := &mockStore{data: map[string][]byte{
		cacheKey: payload,
	}}
	cache, err := New(store, Config{})
	if err != nil {
		t.Fatalf("New(): %v", err)
	}

	body, found := cache.Lookup(context.Background(), id, 1)
	if !found {
		t.Error("Lookup(): found = false, want true")
	}
	if string(body) != string(payload) {
		t.Errorf("Lookup(): body = %q, want %q", body, payload)
	}
}

// TestLookupMiss validates that Lookup returns false for a missing key.
func TestLookupMiss(t *testing.T) {
	store := &mockStore{data: make(map[string][]byte)}
	cache, err := New(store, Config{})
	if err != nil {
		t.Fatalf("New(): %v", err)
	}

	id := Identity{
		Host:     "host.test",
		Locale:   i18n.Locale("en"),
		Resource: ResourceStore,
	}
	_, found := cache.Lookup(context.Background(), id, 1)
	if found {
		t.Error("Lookup(): found = true, want false")
	}
}

// TestSaveValidPayload validates that Save stores a payload.
func TestSaveValidPayload(t *testing.T) {
	store := &mockStore{data: make(map[string][]byte)}
	cache, err := New(store, Config{
		TTL:             5 * time.Minute,
		MaxPayloadBytes: 256 << 10,
	})
	if err != nil {
		t.Fatalf("New(): %v", err)
	}

	id := Identity{
		Host:     "host.test",
		Locale:   i18n.Locale("en"),
		Resource: ResourceStore,
	}
	payload := []byte(`{"name":"Store"}`)
	cache.Save(context.Background(), id, 1, payload)

	if len(store.data) == 0 {
		t.Fatal("Save(): store is empty, want 1 entry")
	}
}

// TestSaveZeroRevision validates that Save skips a zero revision.
func TestSaveZeroRevision(t *testing.T) {
	store := &mockStore{data: make(map[string][]byte)}
	cache, err := New(store, Config{})
	if err != nil {
		t.Fatalf("New(): %v", err)
	}

	id := Identity{
		Host:     "host.test",
		Locale:   i18n.Locale("en"),
		Resource: ResourceStore,
	}
	cache.Save(context.Background(), id, 0, []byte(`{}`))

	if len(store.data) != 0 {
		t.Error("Save() with zero revision: stored entry, want skipped")
	}
}

// TestSaveEmptyPayload validates that Save skips an empty payload.
func TestSaveEmptyPayload(t *testing.T) {
	store := &mockStore{data: make(map[string][]byte)}
	cache, err := New(store, Config{})
	if err != nil {
		t.Fatalf("New(): %v", err)
	}

	id := Identity{
		Host:     "host.test",
		Locale:   i18n.Locale("en"),
		Resource: ResourceStore,
	}
	cache.Save(context.Background(), id, 1, []byte{})

	if len(store.data) != 0 {
		t.Error("Save() with empty payload: stored entry, want skipped")
	}
}

// TestSaveOversizePayload validates that Save skips an oversized payload.
func TestSaveOversizePayload(t *testing.T) {
	maxSize := 100
	store := &mockStore{data: make(map[string][]byte)}
	cache, err := New(store, Config{MaxPayloadBytes: maxSize})
	if err != nil {
		t.Fatalf("New(): %v", err)
	}

	id := Identity{
		Host:     "host.test",
		Locale:   i18n.Locale("en"),
		Resource: ResourceStore,
	}
	oversizePayload := make([]byte, maxSize+1)
	cache.Save(context.Background(), id, 1, oversizePayload)

	if len(store.data) != 0 {
		t.Error("Save() with oversized payload: stored entry, want skipped")
	}
}

// TestKeyUniqueness validates that different identities produce different keys.
func TestKeyUniqueness(t *testing.T) {
	base := Identity{
		Host:     "host.test",
		Locale:   i18n.Locale("en"),
		Resource: ResourceStore,
	}

	keyBase := Key(base, 1)

	// Different host
	diffHost := base
	diffHost.Host = "other.test"
	if Key(diffHost, 1) == keyBase {
		t.Error("Key(): different hosts produced identical keys")
	}

	// Different locale
	diffLocale := base
	diffLocale.Locale = i18n.Locale("es")
	if Key(diffLocale, 1) == keyBase {
		t.Error("Key(): different locales produced identical keys")
	}

	// Different revision
	if Key(base, 1) == Key(base, 2) {
		t.Error("Key(): different revisions produced identical keys")
	}

	// Different resource
	diffResource := base
	diffResource.Resource = ResourceProducts
	if Key(diffResource, 1) == keyBase {
		t.Error("Key(): different resources produced identical keys")
	}
}

// TestHostLabelNormalization validates that hostLabel normalizes DNS names.
func TestHostLabelNormalization(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"host.test", "host.test"},
		{"HOST.TEST", "host.test"},
		{"  host.test  ", "host.test"},
		{"host:8080", "host_8080"},
		{"127.0.0.1", "127.0.0.1"},
	}

	for _, test := range tests {
		result := hostLabel(test.input)
		if result != test.expected {
			t.Errorf("hostLabel(%q) = %q, want %q", test.input, result, test.expected)
		}
	}
}

// TestCanonicalQueryDeterminism validates that canonicalQuery is deterministic.
func TestCanonicalQueryDeterminism(t *testing.T) {
	query := &coreclient.ProductQuery{
		CategorySlug: "Electronics",
		Keyword:      "laptop",
	}

	key1 := Key(Identity{
		Host:     "host.test",
		Locale:   i18n.Locale("en"),
		Resource: ResourceSearch,
		Query:    query,
	}, 1)

	key2 := Key(Identity{
		Host:     "host.test",
		Locale:   i18n.Locale("en"),
		Resource: ResourceSearch,
		Query:    query,
	}, 1)

	if key1 != key2 {
		t.Error("Key() not deterministic for same query")
	}
}

// TestMaxPayloadBytes validates that MaxPayloadBytes returns the configured bound.
func TestMaxPayloadBytes(t *testing.T) {
	maxSize := 1000
	store := &mockStore{data: make(map[string][]byte)}
	cache, err := New(store, Config{MaxPayloadBytes: maxSize})
	if err != nil {
		t.Fatalf("New(): %v", err)
	}

	if cache.MaxPayloadBytes() != maxSize {
		t.Errorf("MaxPayloadBytes() = %d, want %d", cache.MaxPayloadBytes(), maxSize)
	}
}

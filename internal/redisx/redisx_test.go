package redisx
package redisx

import (
	"context"
	"testing"
	"time"
)

// TestNewValidConfig validates that New accepts a valid configuration.
func TestNewValidConfig(t *testing.T) {
	client, err := New(Config{
		Addr:               "localhost:6379",
		Password:           "",
		DB:                 0,
		ConnectTimeout:     0, // Use default
		OperationTimeout:   0, // Use default
	})
	if err != nil {
		t.Fatalf("New() with valid config: %v", err)
	}
	if client == nil {
		t.Fatal("New() returned nil client")
	}
	if err := client.Close(); err != nil {
		t.Logf("Close() error: %v", err)
	}
}

// TestNewMissingAddress validates that New rejects a missing address.
func TestNewMissingAddress(t *testing.T) {
	_, err := New(Config{Addr: ""})
	if err == nil {
		t.Fatal("New() with empty address: want error, got nil")
	}
}

// TestNewInvalidAddress validates that New rejects a malformed address.
func TestNewInvalidAddress(t *testing.T) {
	_, err := New(Config{Addr: "localhost"}) // Missing port
	if err == nil {
		t.Fatal("New() with invalid address: want error, got nil")
	}
}

// TestNewNegativeDB validates that New rejects a negative database index.
func TestNewNegativeDB(t *testing.T) {
	_, err := New(Config{
		Addr: "localhost:6379",
		DB:   -1,
	})
	if err == nil {
		t.Fatal("New() with negative DB: want error, got nil")
	}
}

// TestDefaultTimeouts validates that New applies default timeouts.
func TestDefaultTimeouts(t *testing.T) {
	client, err := New(Config{Addr: "localhost:6379"})
	if err != nil {
		t.Fatalf("New(): %v", err)
	}
	defer client.Close()

	if client.operationTimeout != defaultOperationTimeout {
		t.Errorf("operation timeout = %v, want %v", client.operationTimeout, defaultOperationTimeout)
	}
}

// TestSetInvalidTTL validates that Set rejects a zero or negative TTL.
func TestSetInvalidTTL(t *testing.T) {
	client, err := New(Config{Addr: "localhost:6379"})
	if err != nil {
		t.Fatalf("New(): %v", err)
	}
	defer client.Close()

	ctx := context.Background()
	if err := client.Set(ctx, "key", []byte("value"), 0); err == nil {
		t.Fatal("Set() with zero TTL: want error, got nil")
	}
	if err := client.Set(ctx, "key", []byte("value"), -1*time.Second); err == nil {
		t.Fatal("Set() with negative TTL: want error, got nil")
	}
}

// TestGetMissingKey validates that Get returns found=false for a missing key.
func TestGetMissingKey(t *testing.T) {
	client, err := New(Config{Addr: "localhost:6379"})
	if err != nil {
		t.Fatalf("New(): %v", err)
	}
	defer client.Close()

	ctx := context.Background()
	value, found, err := client.Get(ctx, "nonexistent-key-xyz")
	if err != nil {
		t.Fatalf("Get() on missing key: %v", err)
	}
	if found {
		t.Error("Get() on missing key: found = true, want false")
	}
	if len(value) != 0 {
		t.Errorf("Get() on missing key: value = %v, want empty", value)
	}
}

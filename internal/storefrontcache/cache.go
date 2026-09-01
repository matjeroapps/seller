// Package storefrontcache is the Seller-owned payload cache for the public
// storefront.
//
// It caches the encoded public response body of an anonymous storefront GET and
// nothing else. Correctness comes entirely from the cache key: every entry is
// namespaced by the authoritative per-store cache generation ("revision") that
// Core owns, so invalidation never deletes anything. When a store's public
// output changes, Core advances its revision, every subsequent lookup moves into
// a new namespace, and the abandoned entries expire through the TTL. That is why
// this package needs no wildcard scan, no key registry, no second event system
// and no distributed lock.
//
// The cache is an optimization, never an authority. A Redis failure is reported
// as a miss and the caller falls back to Core, and a payload is only ever stored
// under the revision Core returned with that payload.
package storefrontcache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/matjeroapps/seller/internal/coreclient"
	"github.com/matjeroapps/seller/internal/i18n"
)

// schemaVersion namespaces every key produced by this package.
//
// It is bumped whenever the meaning or shape of a cached payload changes in a
// way a revision bump would not describe, such as a change to the public DTO or
// to the identity encoding below. Bumping it abandons every previous entry
// without deleting one.
const schemaVersion = "v1"

// keyPrefix identifies keys owned by this cache inside a shared Redis.
const keyPrefix = "mjsf"

// Public resources. Each is a distinct Core read, so each gets its own cache
// identity: two resources never share an entry even when their parameters match.
const (
	ResourceStore      = "store"
	ResourceCategories = "categories"
	ResourceCategory   = "category"
	ResourceProducts   = "products"
	ResourceProduct    = "product"
	ResourceSearch     = "search"
)

// maxHostLabel bounds the readable host segment of a key. The exact host is
// always covered by the identity digest, so truncating the readable segment
// cannot collide two tenants; it only keeps key length bounded.
const maxHostLabel = 100

// Defaults. The TTL is a safety net rather than a correctness mechanism: a
// revision bump already makes an entry unreachable, and the TTL is what
// eventually reclaims it.
const (
	defaultTTL             = 5 * time.Minute
	defaultMaxPayloadBytes = 256 << 10
)

// Store is the key/value backend. *redisx.Client satisfies it.
//
// It exposes only a bounded get and a bounded set with an expiry. There is
// deliberately no delete, no scan and no pattern operation: invalidation happens
// by moving to a new revision namespace, and a cache that cannot enumerate keys
// cannot grow a wildcard invalidation path by accident.
type Store interface {
	Get(ctx context.Context, key string) ([]byte, bool, error)
	Set(ctx context.Context, key string, value []byte, ttl time.Duration) error
}

// Config configures the cache.
type Config struct {
	// TTL bounds how long an entry may live. Defaults to 5 minutes.
	TTL time.Duration
	// MaxPayloadBytes bounds the size of a single cached body. A larger
	// successful response is served normally and simply not stored, so one
	// unusually large store cannot dominate the cache. Defaults to 256 KiB.
	MaxPayloadBytes int
	// Logger records cache degradation. Optional.
	Logger *slog.Logger
}

// Cache stores encoded public storefront payloads.
type Cache struct {
	store           Store
	ttl             time.Duration
	maxPayloadBytes int
	logger          *slog.Logger
}

// New builds a cache over a backend.
func New(store Store, cfg Config) (*Cache, error) {
	if store == nil {
		return nil, errors.New("storefrontcache: store is required")
	}
	ttl := cfg.TTL
	if ttl <= 0 {
		ttl = defaultTTL
	}
	maxPayloadBytes := cfg.MaxPayloadBytes
	if maxPayloadBytes <= 0 {
		maxPayloadBytes = defaultMaxPayloadBytes
	}
	return &Cache{store: store, ttl: ttl, maxPayloadBytes: maxPayloadBytes, logger: cfg.Logger}, nil
}

// Identity is everything other than the revision that distinguishes one cached
// payload from another.
//
// Host is the trusted, normalized storefront host the caller derived from its
// own proxy policy. It is the tenant authority: no client-supplied store,
// seller or forwarded-host value may ever reach this field, or one tenant could
// read another's cached payload.
type Identity struct {
	Host     string
	Locale   i18n.Locale
	Resource string
	// Slug is the resource identity for single-resource reads. Empty otherwise.
	Slug string
	// Query is the validated browse query for collection reads. Nil otherwise.
	Query *coreclient.ProductQuery
}

// Lookup returns the cached body for an identity at a revision.
//
// A miss, a backend failure and a timeout are all reported the same way, because
// the caller's response to all three is identical: read from Core. The error is
// logged rather than returned so a cache outage cannot become a customer-visible
// failure.
func (c *Cache) Lookup(ctx context.Context, id Identity, revision int64) ([]byte, bool) {
	body, found, err := c.store.Get(ctx, Key(id, revision))
	if err != nil {
		c.log("storefront cache read failed", id, err)
		return nil, false
	}
	return body, found
}

// Save stores a body under the revision Core returned with it.
//
// The revision must be the one labelled on the response that produced body,
// never one probed earlier: a payload stored under an older generation would be
// served for that generation's whole lifetime, whereas a payload stored under a
// newer generation is simply abandoned at the next bump. A body without a
// revision, or one larger than the configured bound, is not stored.
func (c *Cache) Save(ctx context.Context, id Identity, revision int64, body []byte) {
	if revision <= 0 || len(body) == 0 || len(body) > c.maxPayloadBytes {
		return
	}
	if err := c.store.Set(ctx, Key(id, revision), body, c.ttl); err != nil {
		c.log("storefront cache write failed", id, err)
	}
}

// MaxPayloadBytes reports the configured payload bound.
func (c *Cache) MaxPayloadBytes() int { return c.maxPayloadBytes }

// log records a cache failure without disclosing a payload or a key. The host is
// safe to log: it is the tenant the request already named.
func (c *Cache) log(message string, id Identity, err error) {
	if c.logger == nil {
		return
	}
	c.logger.Warn(message,
		slog.String("host", id.Host),
		slog.String("resource", id.Resource),
		slog.String("error", err.Error()),
	)
}

// Key builds the cache key for an identity at a revision.
//
// The readable segments make an entry identifiable in a running Redis; the
// trailing digest is what makes the key unambiguous. Every identity field,
// including the exact host, is covered by the digest over a length-prefixed
// encoding, so no host, slug or query value can be crafted to collide with
// another tenant's key by embedding a separator.
func Key(id Identity, revision int64) string {
	return strings.Join([]string{
		keyPrefix,
		schemaVersion,
		hostLabel(id.Host),
		strconv.FormatInt(revision, 10),
		string(id.Locale),
		id.Resource,
		digest(id),
	}, ":")
}

// digest hashes the exact identity. Length-prefixing each field makes the
// encoding injective: no combination of values can produce the encoding of a
// different combination.
func digest(id Identity) string {
	var sb strings.Builder
	writeField(&sb, "host", strings.ToLower(strings.TrimSpace(id.Host)))
	writeField(&sb, "locale", string(id.Locale))
	writeField(&sb, "resource", id.Resource)
	writeField(&sb, "slug", strings.ToLower(strings.TrimSpace(id.Slug)))
	writeField(&sb, "query", canonicalQuery(id.Query))

	sum := sha256.Sum256([]byte(sb.String()))
	return hex.EncodeToString(sum[:])
}

func writeField(sb *strings.Builder, name, value string) {
	fmt.Fprintf(sb, "%s=%d:%s;", name, len(value), value)
}

// canonicalQuery encodes a validated browse query as a deterministic identity.
//
// Only parameters the storefront actually validates and forwards to Core appear
// here, so a parameter Core never sees cannot fragment the cache or be used to
// poison an entry: an unknown query parameter is absent from the identity by
// construction rather than by an allow-list that has to be maintained.
//
// Values that Core treats case-insensitively are lowercased, so two spellings of
// one request share an entry instead of storing the same payload twice. Absent
// optional values are encoded distinctly from present ones, so "no limit" and
// "limit=0" can never collapse into the same identity.
func canonicalQuery(query *coreclient.ProductQuery) string {
	if query == nil {
		return ""
	}
	fields := []string{
		"category=" + strings.ToLower(strings.TrimSpace(query.CategorySlug)),
		"q=" + strings.ToLower(strings.TrimSpace(query.Keyword)),
		"availability=" + strings.ToLower(strings.TrimSpace(query.Availability)),
		"sort=" + strings.ToLower(strings.TrimSpace(query.Sort)),
		"min_price=" + optionalInt(query.MinPriceMinor),
		"max_price=" + optionalInt(query.MaxPriceMinor),
		"limit=" + optionalInt(query.Limit),
		"offset=" + optionalInt(query.Offset),
	}
	return strings.Join(fields, "&")
}

func optionalInt(value *int64) string {
	if value == nil {
		return "-"
	}
	return strconv.FormatInt(*value, 10)
}

// hostLabel renders the readable host segment of a key.
//
// Anything outside the DNS character set is replaced rather than passed through:
// a control character would make a key unreadable in operational tooling, and a
// brace would be interpreted as a Redis Cluster hash tag and change which slot
// the key lands in.
func hostLabel(host string) string {
	host = strings.ToLower(strings.TrimSpace(host))
	if len(host) > maxHostLabel {
		host = host[:maxHostLabel]
	}
	var sb strings.Builder
	sb.Grow(len(host))
	for _, r := range host {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '.', r == '-':
			sb.WriteRune(r)
		default:
			sb.WriteByte('_')
		}
	}
	return sb.String()
}

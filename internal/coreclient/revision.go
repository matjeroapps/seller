package coreclient

import (
	"context"
	"net/http"
	"strconv"
)

// HeaderStorefrontRevision labels a successful Core storefront read with the
// public cache generation its payload is guaranteed to be at least as new as.
//
// The name is part of the Core internal API contract and is reproduced here
// rather than imported, for the same reason the error codes are: this repository
// must not depend on Core to learn its own transport contract.
//
// Core reads the revision before the payload, so the label is a lower bound on
// the payload's freshness. A cache therefore stores each response under the
// revision returned with it, never under one it probed earlier: caching fresher
// data under an older generation is harmless because that generation is
// abandoned on the next probe, whereas caching older data under a newer
// generation would serve stale content for the whole entry lifetime.
const HeaderStorefrontRevision = "X-Matjero-Storefront-Revision"

// storefrontRevisionResponse is the wire shape of the revision probe.
type storefrontRevisionResponse struct {
	Revision int64 `json:"revision"`
}

// StorefrontRevision reads the authoritative public cache generation of a
// trusted host.
//
// This is the probe a cache calls before trusting a cached payload. It fails the
// same way every other public read does: an unknown host, an inactive domain and
// an inactive store are indistinguishable and yield no revision, which is what
// stops a cache from continuing to serve a store that stopped resolving
// publicly. The value is opaque; only equality is meaningful.
func (c *Client) StorefrontRevision(ctx context.Context, host string) (int64, error) {
	var payload storefrontRevisionResponse
	err := c.get(ctx, "/internal/v1/storefront/revision", nil, requestOptions{
		StorefrontHost: host,
	}, &payload)
	return payload.Revision, err
}

// revisionFrom reads the revision label off a Core response.
//
// A missing or unparsable label yields 0, which callers treat as "this response
// carries no generation" and therefore must not cache. That keeps an older Core
// release, or a proxy that strips the header, from being cached under a
// fabricated generation.
func revisionFrom(header http.Header) int64 {
	raw := header.Get(HeaderStorefrontRevision)
	if raw == "" {
		return 0
	}
	revision, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || revision <= 0 {
		return 0
	}
	return revision
}

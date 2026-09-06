package main

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"time"
)

// oidcAuthority is the test-only OIDC issuer fake-core provides so seller-api
// can verify end-user bearer tokens without a real Zitadel instance (ADR-017:
// the same contract, a deterministic double).
type oidcAuthority struct {
	issuer string
	key    *rsa.PrivateKey
	kid    string
	aud    string
}

func newOIDCAuthority(issuer, audience string) (*oidcAuthority, error) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, fmt.Errorf("generate rsa key: %w", err)
	}
	sum := sha256.Sum256(x509.MarshalPKCS1PublicKey(&key.PublicKey))
	return &oidcAuthority{
		issuer: issuer,
		key:    key,
		kid:    hex.EncodeToString(sum[:8]),
		aud:    audience,
	}, nil
}

// discovery serves the OIDC provider metadata seller-api discovers at startup.
func (o *oidcAuthority) discovery(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"issuer":                                o.issuer,
		"jwks_uri":                              o.issuer + "/jwks.json",
		"subject_types_supported":               []string{"public"},
		"id_token_signing_alg_values_supported": []string{"RS256"},
		"response_types_supported":              []string{"code"},
		"claims_supported":                      []string{"iss", "sub", "aud", "exp", "iat", "email", "preferred_username"},
		"token_endpoint":                        o.issuer + "/oauth/token",
	})
}

// jwks serves the RSA public key as a JSON Web Key Set.
func (o *oidcAuthority) jwks(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"keys": []map[string]any{{
			"kty": "RSA",
			"use": "sig",
			"alg": "RS256",
			"kid": o.kid,
			"n":   base64.RawURLEncoding.EncodeToString(o.key.PublicKey.N.Bytes()),
			"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(o.key.PublicKey.E)).Bytes()),
		}},
	})
}

// mintToken signs an RS256 JWT for the requested subject with the claims
// seller-api's auth middleware expects: iss, aud ("seller-api"), sub, a Zitadel
// project roles map (parsed by internal/auth) with the seller roles, plus the
// standard "roles" array, email, and preferred_username.
func (o *oidcAuthority) mintToken(subject string) (string, error) {
	if subject == "" {
		subject = "usr_seller_dev"
	}
	now := time.Now().UTC()
	claims := map[string]any{
		"iss":                o.issuer,
		"sub":                subject,
		"aud":                o.aud,
		"iat":                now.Unix(),
		"exp":                now.Add(5 * time.Hour).Unix(),
		"email":              subject + "@matjero.test",
		"preferred_username": "seller_dev",
		"locale":             "en",
		"roles":              []string{"seller_owner"},
		"urn:zitadel:iam:org:project:roles": map[string]any{
			"seller_owner":   "seller-owner",
			"seller_manager": "seller-manager",
			"seller_staff":   "seller-staff",
		},
	}
	return o.signRS256(claims)
}

func (o *oidcAuthority) signRS256(claims map[string]any) (string, error) {
	header, err := json.Marshal(map[string]any{"alg": "RS256", "typ": "JWT", "kid": o.kid})
	if err != nil {
		return "", err
	}
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	signingInput := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(payload)
	sum := sha256.Sum256([]byte(signingInput))
	sig, err := rsa.SignPKCS1v15(rand.Reader, o.key, crypto.SHA256, sum[:])
	if err != nil {
		return "", err
	}
	return signingInput + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}

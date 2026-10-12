package sellerapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"seller/internal/coreclient"
)

// Authoring capability on the shared stub: records the subject, store and
// idempotency key the handler forwarded, and returns canned results or the
// seeded error.
var (
	stubAuthoringLimits = coreclient.AuthoringLimits{EffectiveLimit: 7, DefaultCount: 3}
	stubAuthoringJob    = coreclient.AuthoringJob{
		ID:                  "job-1",
		StoreID:             "store-1",
		Status:              "partial",
		TextStatus:          "succeeded",
		ImageStatus:         "failed",
		Brief:               "برief",
		RequestedImageCount: 2,
		EffectiveImageLimit: 7,
		ErrorCode:           "ai_provider_not_configured",
		ImageCandidates: []coreclient.AuthoringImageCandidate{{
			ID:            "cand-1",
			StoreID:       "store-1",
			SourceAssetID: "asset-1",
			SceneKey:      "coffee",
			URL:           "https://media.example/scene.png",
			ContentType:   "image/png",
			Visibility:    "hidden",
			Status:        "proposed",
		}},
	}
)

var (
	stubAuthoringSubject       string
	stubAuthoringStoreID       string
	stubAuthoringIdempotency   string
	stubAuthoringCreateRequest coreclient.CreateAuthoringJobRequest
)

func (s *stubCore) GetAuthoringLimits(ctx context.Context, subject, storeID string) (coreclient.AuthoringLimits, error) {
	if s.err != nil {
		return coreclient.AuthoringLimits{}, s.err
	}
	stubAuthoringSubject = subject
	stubAuthoringStoreID = storeID
	return stubAuthoringLimits, nil
}

func (s *stubCore) CreateAuthoringJob(ctx context.Context, subject, storeID, idempotencyKey string, req coreclient.CreateAuthoringJobRequest) (coreclient.AuthoringJob, error) {
	if s.err != nil {
		return coreclient.AuthoringJob{}, s.err
	}
	stubAuthoringSubject = subject
	stubAuthoringStoreID = storeID
	stubAuthoringIdempotency = idempotencyKey
	stubAuthoringCreateRequest = req
	return stubAuthoringJob, nil
}

func (s *stubCore) GetAuthoringJob(ctx context.Context, subject, storeID, jobID string) (coreclient.AuthoringJob, error) {
	if s.err != nil {
		return coreclient.AuthoringJob{}, s.err
	}
	stubAuthoringSubject = subject
	stubAuthoringStoreID = storeID
	return stubAuthoringJob, nil
}

func (s *stubCore) RetryAuthoringJob(ctx context.Context, subject, storeID, jobID, idempotencyKey string, req coreclient.RetryAuthoringJobRequest) (coreclient.AuthoringJob, error) {
	if s.err != nil {
		return coreclient.AuthoringJob{}, s.err
	}
	stubAuthoringSubject = subject
	return stubAuthoringJob, nil
}

func (s *stubCore) UpdateAuthoringField(ctx context.Context, subject, storeID, jobID, fieldID, idempotencyKey string, req coreclient.UpdateAuthoringFieldRequest) (coreclient.AuthoringFieldProposal, error) {
	if s.err != nil {
		return coreclient.AuthoringFieldProposal{}, s.err
	}
	stubAuthoringSubject = subject
	return coreclient.AuthoringFieldProposal{ID: fieldID, FieldKey: "name", Locale: "ar", Status: "accepted", Value: req.Value, EditedBySubject: subject}, nil
}

func (s *stubCore) AcceptAuthoringImage(ctx context.Context, subject, storeID, jobID, candidateID, idempotencyKey string, req coreclient.AcceptAuthoringImageRequest) (coreclient.AuthoringImageCandidate, error) {
	if s.err != nil {
		return coreclient.AuthoringImageCandidate{}, s.err
	}
	stubAuthoringSubject = subject
	accepted := stubAuthoringJob.ImageCandidates[0]
	accepted.Status = "accepted"
	return accepted, nil
}

// Job creation must succeed without any provider being configured anywhere:
// providers live in Core only and are entirely invisible to Seller.
func TestSellerCreateAuthoringJobWithoutProviderConfiguration(t *testing.T) {
	core := &stubCore{}
	handler := newHandlerWithRole(core, core, roleManager)
	body := `{"brief":"منتج قهوة","source_asset_ids":["asset-1"],"requested_image_count":2}`
	req := httptest.NewRequest(http.MethodPost, "/v1/seller/stores/store-1/ai-authoring/jobs", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", "idem-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create status = %d without any provider configured, want 201 (body %q)", rec.Code, rec.Body.String())
	}
	if stubAuthoringSubject != testSubject || stubAuthoringStoreID != "store-1" {
		t.Fatalf("forwarded subject/store = %q/%q", stubAuthoringSubject, stubAuthoringStoreID)
	}
	if stubAuthoringIdempotency != "idem-1" {
		t.Fatalf("forwarded idempotency key = %q", stubAuthoringIdempotency)
	}
	if stubAuthoringCreateRequest.Brief != "منتج قهوة" || stubAuthoringCreateRequest.RequestedImageCount != 2 {
		t.Fatalf("forwarded create request = %+v", stubAuthoringCreateRequest)
	}
	// No provider vocabulary leaks in the created-job representation.
	for _, needle := range []string{"storage_key", "openai", "api_key", "api_url", "\"model\"", "provider_name", "configuration"} {
		if strings.Contains(rec.Body.String(), needle) {
			t.Fatalf("create response leaks provider vocabulary %q: %s", needle, rec.Body.String())
		}
	}
}

func TestSellerAuthoringRoles(t *testing.T) {
	// staff may read; the mutating paths are beyond staff.
	staff := newHandlerWithRole(&stubCore{}, &stubCore{}, roleStaff)
	rec := doRequest(t, staff, http.MethodGet, "/v1/seller/stores/store-1/ai-authoring/limits", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("staff limits status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}
	rec = doRequest(t, staff, http.MethodPost, "/v1/seller/stores/store-1/ai-authoring/jobs", `{"brief":"b","requested_image_count":1}`)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("staff create status = %d, want 403", rec.Code)
	}

	// owner passes the role gate but must still supply an idempotency key.
	owner := newHandlerWithRole(&stubCore{}, &stubCore{}, roleOwner)
	rec = doRequest(t, owner, http.MethodPost, "/v1/seller/stores/store-1/ai-authoring/jobs", `{"brief":"b","requested_image_count":1}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("create without Idempotency-Key status = %d, want 400", rec.Code)
	}
	if code := decodeError(t, rec); code != "validation_error" {
		t.Fatalf("missing idempotency error code = %q, want validation_error", code)
	}
}

// Core's classified provider failures are job/branch state, not HTTP errors:
// the Seller API maps the API-level codes it defines onto their statuses and
// never forwards a provider identifier, model or raw message.
func TestSellerAuthoringErrorMapping(t *testing.T) {
	limited := &stubCore{err: &coreclient.Error{Status: http.StatusBadRequest, Code: coreclient.CodeAILimitExceeded, Message: "nope"}}
	owner := newHandlerWithRole(limited, &stubCore{}, roleOwner)
	req := httptest.NewRequest(http.MethodPost, "/v1/seller/stores/store-1/ai-authoring/jobs", strings.NewReader(`{"brief":"b","requested_image_count":1}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", "k")
	rec := httptest.NewRecorder()
	owner.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "ai_limit_exceeded") {
		t.Fatalf("ai_limit_exceeded = %d %q, want 400 with code", rec.Code, rec.Body.String())
	}

	conflicted := &stubCore{err: &coreclient.Error{Status: http.StatusConflict, Code: coreclient.CodeAIJobNotRetryable, Message: "exhausted"}}
	owner = newHandlerWithRole(conflicted, &stubCore{}, roleOwner)
	rec = doRequest(t, owner, http.MethodPost, "/v1/seller/stores/store-1/ai-authoring/jobs/j-1/retry", `{"parts":["image"]}`)
	if rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), "ai_job_not_retryable") {
		t.Fatalf("ai_job_not_retryable = %d %q, want 409 with code", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), "exhausted") {
		t.Fatalf("raw core message must not leak: %s", rec.Body.String())
	}
}

// The candidate-acceptance route passes the merchant decision straight to
// Core (visibility defaulting to false) and is beyond staff.
func TestSellerAcceptAuthoringImageRoute(t *testing.T) {
	staff := newHandlerWithRole(&stubCore{}, &stubCore{}, roleStaff)
	rec := doRequest(t, staff, http.MethodPost, "/v1/seller/stores/store-1/ai-authoring/jobs/job-1/images/cand-1/accept", `{"is_visible":true,"alt_text":"front"}`)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("staff accept status = %d, want 403", rec.Code)
	}

	stubAuthoringSubject = ""
	owner := newHandlerWithRole(&stubCore{}, &stubCore{}, roleOwner)
	rec = doRequest(t, owner, http.MethodPost, "/v1/seller/stores/store-1/ai-authoring/jobs/job-1/images/cand-1/accept", `{"is_visible":false,"alt_text":"front"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("accept status = %d, want 200 (body %q)", rec.Code, rec.Body.String())
	}
	if stubAuthoringSubject != testSubject {
		t.Fatalf("forwarded subject = %q", stubAuthoringSubject)
	}
}

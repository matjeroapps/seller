package sellerapi

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"

	"seller/internal/actorhttp"
	"seller/internal/coreclient"
	"seller/internal/httpx"
)

type authoringCoreCapabilities interface {
	GetAuthoringLimits(ctx context.Context, subject, storeID string) (coreclient.AuthoringLimits, error)
	CreateAuthoringJob(ctx context.Context, subject, storeID, idempotencyKey string, req coreclient.CreateAuthoringJobRequest) (coreclient.AuthoringJob, error)
	GetAuthoringJob(ctx context.Context, subject, storeID, jobID string) (coreclient.AuthoringJob, error)
	RetryAuthoringJob(ctx context.Context, subject, storeID, jobID, idempotencyKey string, req coreclient.RetryAuthoringJobRequest) (coreclient.AuthoringJob, error)
	UpdateAuthoringField(ctx context.Context, subject, storeID, jobID, fieldID, idempotencyKey string, req coreclient.UpdateAuthoringFieldRequest) (coreclient.AuthoringFieldProposal, error)
	AcceptAuthoringImage(ctx context.Context, subject, storeID, jobID, candidateID, idempotencyKey string, req coreclient.AcceptAuthoringImageRequest) (coreclient.AuthoringImageCandidate, error)
}

func (deps Dependencies) authoringCore(w http.ResponseWriter) (authoringCoreCapabilities, bool) {
	core, ok := deps.Core.(authoringCoreCapabilities)
	if !ok {
		httpx.WriteError(w, http.StatusServiceUnavailable, "service_unavailable", "service temporarily unavailable")
		return nil, false
	}
	return core, true
}

func (deps Dependencies) handleAuthoringLimits(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	core, ok := deps.authoringCore(w)
	if !ok {
		return
	}
	res, err := core.GetAuthoringLimits(r.Context(), subject, chi.URLParam(r, "store_id"))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (deps Dependencies) handleCreateAuthoringJob(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	var req coreclient.CreateAuthoringJobRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}
	idempotencyKey := r.Header.Get("Idempotency-Key")
	if idempotencyKey == "" {
		httpx.WriteError(w, http.StatusBadRequest, "validation_error", "Idempotency-Key is required")
		return
	}
	core, ok := deps.authoringCore(w)
	if !ok {
		return
	}
	res, err := core.CreateAuthoringJob(r.Context(), subject, chi.URLParam(r, "store_id"), idempotencyKey, req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, res)
}

func (deps Dependencies) handleGetAuthoringJob(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager, roleStaff) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	core, ok := deps.authoringCore(w)
	if !ok {
		return
	}
	res, err := core.GetAuthoringJob(r.Context(), subject, chi.URLParam(r, "store_id"), chi.URLParam(r, "job_id"))
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (deps Dependencies) handleRetryAuthoringJob(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	var req coreclient.RetryAuthoringJobRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}
	core, ok := deps.authoringCore(w)
	if !ok {
		return
	}
	res, err := core.RetryAuthoringJob(r.Context(), subject, chi.URLParam(r, "store_id"), chi.URLParam(r, "job_id"), r.Header.Get("Idempotency-Key"), req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (deps Dependencies) handleUpdateAuthoringField(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	var req coreclient.UpdateAuthoringFieldRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}
	core, ok := deps.authoringCore(w)
	if !ok {
		return
	}
	res, err := core.UpdateAuthoringField(r.Context(), subject, chi.URLParam(r, "store_id"), chi.URLParam(r, "job_id"), chi.URLParam(r, "field_id"), r.Header.Get("Idempotency-Key"), req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (deps Dependencies) handleAcceptAuthoringImage(w http.ResponseWriter, r *http.Request) {
	if !requireRoles(w, r, roleOwner, roleManager) {
		return
	}
	subject, _, ok := deps.sellerID(w, r)
	if !ok {
		return
	}
	var req coreclient.AcceptAuthoringImageRequest
	if !actorhttp.DecodeJSON(w, r, &req) {
		return
	}
	core, ok := deps.authoringCore(w)
	if !ok {
		return
	}
	res, err := core.AcceptAuthoringImage(r.Context(), subject, chi.URLParam(r, "store_id"), chi.URLParam(r, "job_id"), chi.URLParam(r, "candidate_id"), r.Header.Get("Idempotency-Key"), req)
	if err != nil {
		actorhttp.WriteCoreError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

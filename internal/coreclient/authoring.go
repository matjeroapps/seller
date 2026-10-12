package coreclient

import (
	"context"
	"net/url"
)

type AuthoringLimits struct {
	EffectiveLimit int `json:"effective_limit"`
	DefaultCount   int `json:"default_count"`
}

type AuthoringJob struct {
	ID                  string                    `json:"id"`
	StoreID             string                    `json:"store_id"`
	Status              string                    `json:"status"`
	TextStatus          string                    `json:"text_status"`
	ImageStatus         string                    `json:"image_status"`
	Brief               string                    `json:"brief"`
	RequestedImageCount int                       `json:"requested_image_count"`
	EffectiveImageLimit int                       `json:"effective_image_limit"`
	Attempts            int                       `json:"attempts"`
	ErrorCode           string                    `json:"error_code"`
	ErrorMessage        string                    `json:"error_message"`
	CreatedAt           string                    `json:"created_at"`
	UpdatedAt           string                    `json:"updated_at"`
	StartedAt           *string                   `json:"started_at"`
	CompletedAt         *string                   `json:"completed_at"`
	Fields              []AuthoringFieldProposal  `json:"fields"`
	ImageCandidates     []AuthoringImageCandidate `json:"image_candidates"`
}

type AuthoringFieldProposal struct {
	ID              string  `json:"id"`
	FieldKey        string  `json:"field_key"`
	Locale          string  `json:"locale"`
	Value           string  `json:"value"`
	AttributeCode   string  `json:"attribute_code"`
	CategoryID      *string `json:"category_id"`
	Status          string  `json:"status"`
	EditedBySubject string  `json:"edited_by_subject"`
	FailureCode     string  `json:"failure_code"`
	UpdatedAt       string  `json:"updated_at"`
}

type AuthoringImageCandidate struct {
	ID            string  `json:"id"`
	StoreID       string  `json:"store_id"`
	SourceAssetID string  `json:"source_asset_id"`
	SceneKey      string  `json:"scene_key"`
	URL           string  `json:"url"`
	ForegroundURL string  `json:"foreground_url"`
	ContentType   string  `json:"content_type"`
	ByteSize      int64   `json:"byte_size"`
	Visibility    string  `json:"visibility"`
	Status        string  `json:"status"`
	AssetID       *string `json:"asset_id"`
	FailureCode   string  `json:"failure_code"`
	RetryCount    int     `json:"retry_count"`
	UpdatedAt     string  `json:"updated_at"`
}

type CreateAuthoringJobRequest struct {
	Brief               string   `json:"brief"`
	SourceAssetIDs      []string `json:"source_asset_ids"`
	RequestedImageCount int      `json:"requested_image_count"`
}

type UpdateAuthoringFieldRequest struct {
	Decision string `json:"decision"`
	Value    string `json:"value"`
}

type RetryAuthoringJobRequest struct {
	Parts        []string `json:"parts"`
	CandidateIDs []string `json:"candidate_ids"`
}

type AcceptAuthoringImageRequest struct {
	IsVisible bool   `json:"is_visible"`
	AltText   string `json:"alt_text"`
}

func (c *Client) GetAuthoringLimits(ctx context.Context, subject, storeID string) (AuthoringLimits, error) {
	var out AuthoringLimits
	err := c.get(ctx, "/internal/v1/stores/"+url.PathEscape(storeID)+"/ai-authoring/limits", nil, requestOptions{Subject: subject}, &out)
	return out, err
}

func (c *Client) CreateAuthoringJob(ctx context.Context, subject, storeID, idempotencyKey string, req CreateAuthoringJobRequest) (AuthoringJob, error) {
	var out AuthoringJob
	err := c.post(ctx, "/internal/v1/stores/"+url.PathEscape(storeID)+"/ai-authoring/jobs", req, requestOptions{Subject: subject, IdempotencyKey: idempotencyKey}, &out)
	return out, err
}

func (c *Client) GetAuthoringJob(ctx context.Context, subject, storeID, jobID string) (AuthoringJob, error) {
	var out AuthoringJob
	err := c.get(ctx, "/internal/v1/stores/"+url.PathEscape(storeID)+"/ai-authoring/jobs/"+url.PathEscape(jobID), nil, requestOptions{Subject: subject}, &out)
	return out, err
}

func (c *Client) RetryAuthoringJob(ctx context.Context, subject, storeID, jobID, idempotencyKey string, req RetryAuthoringJobRequest) (AuthoringJob, error) {
	var out AuthoringJob
	err := c.post(ctx, "/internal/v1/stores/"+url.PathEscape(storeID)+"/ai-authoring/jobs/"+url.PathEscape(jobID)+"/retry", req, requestOptions{Subject: subject, IdempotencyKey: idempotencyKey}, &out)
	return out, err
}

func (c *Client) UpdateAuthoringField(ctx context.Context, subject, storeID, jobID, fieldID, idempotencyKey string, req UpdateAuthoringFieldRequest) (AuthoringFieldProposal, error) {
	var out AuthoringFieldProposal
	err := c.patch(ctx, "/internal/v1/stores/"+url.PathEscape(storeID)+"/ai-authoring/jobs/"+url.PathEscape(jobID)+"/fields/"+url.PathEscape(fieldID), req, requestOptions{Subject: subject, IdempotencyKey: idempotencyKey}, &out)
	return out, err
}

func (c *Client) AcceptAuthoringImage(ctx context.Context, subject, storeID, jobID, candidateID, idempotencyKey string, req AcceptAuthoringImageRequest) (AuthoringImageCandidate, error) {
	var out AuthoringImageCandidate
	err := c.post(ctx, "/internal/v1/stores/"+url.PathEscape(storeID)+"/ai-authoring/jobs/"+url.PathEscape(jobID)+"/images/"+url.PathEscape(candidateID)+"/accept", req, requestOptions{Subject: subject, IdempotencyKey: idempotencyKey}, &out)
	return out, err
}

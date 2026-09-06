package openapi

// Documentation-only schema types for the canonical structured product page
// section contract. Core stores sections as {id, type, enabled, sort_order,
// content} where content mixes GLOBAL fields (shared across locales) and
// LOCALIZED per-locale objects. These types exist purely so the generated
// OpenAPI document can express the per-type content schemas; the runtime
// payload types remain the coreclient DTOs.

import "time"

// SectionContent is the canonical per-type section content. The generator
// renders it as a oneOf over the six canonical content schemas below.
type SectionContent struct{}

// SectionHeadingBody is the localized content of a description or image_text
// section entry.
type SectionHeadingBody struct {
	Heading string `json:"heading"`
	Body    string `json:"body"`
}

// SectionTitleBody is the localized content of a final_cta section entry.
type SectionTitleBody struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

// SectionDescriptionContent localizes description sections: no global fields,
// only en/ar objects carrying {heading, body}.
type SectionDescriptionContent map[string]SectionHeadingBody

// SectionHighlightsLocalized carries the localized fields of a highlights
// section.
type SectionHighlightsLocalized struct {
	Title string   `json:"title"`
	Items []string `json:"items"`
}

// SectionHighlightsContent localizes highlights sections: no global fields.
type SectionHighlightsContent map[string]SectionHighlightsLocalized

// SectionKeyValue is one specification row.
type SectionKeyValue struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// SectionSpecificationsLocalized carries the localized fields of a
// specifications section.
type SectionSpecificationsLocalized struct {
	Items []SectionKeyValue `json:"items"`
}

// SectionSpecificationsContent localizes specifications sections.
type SectionSpecificationsContent map[string]SectionSpecificationsLocalized

// SectionQuestionAnswer is one FAQ row.
type SectionQuestionAnswer struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

// SectionFAQLocalized carries the localized fields of a faq section.
type SectionFAQLocalized struct {
	Items []SectionQuestionAnswer `json:"items"`
}

// SectionFAQContent localizes faq sections.
type SectionFAQContent map[string]SectionFAQLocalized

// SectionLayout is the image placement of an image_text section.
type SectionLayout string

const (
	SectionLayoutLeft  SectionLayout = "left"
	SectionLayoutRight SectionLayout = "right"
)

// SectionImageTextContent mixes GLOBAL fields (media_id referencing product
// media of the same product, and layout) with the localized en/ar objects.
// Unknown top-level keys are rejected by Core.
type SectionImageTextContent struct {
	MediaID string              `json:"media_id"`
	Layout  SectionLayout       `json:"layout" openapi:"enum=left|right"`
	En      *SectionHeadingBody `json:"en,omitempty"`
	Ar      *SectionHeadingBody `json:"ar,omitempty"`
}

// SectionCTAAction is the global call-to-action of a final_cta section.
type SectionCTAAction string

const (
	SectionCTAActionAddToCart SectionCTAAction = "add_to_cart"
	SectionCTAActionBuyNow    SectionCTAAction = "buy_now"
)

// SectionFinalCTAContent mixes the GLOBAL action with the localized en/ar
// objects. No url/href/link fields exist anywhere in the contract.
type SectionFinalCTAContent struct {
	Action SectionCTAAction  `json:"action" openapi:"enum=add_to_cart|buy_now"`
	En     *SectionTitleBody `json:"en,omitempty"`
	Ar     *SectionTitleBody `json:"ar,omitempty"`
}

// PresentationSection is the canonical section envelope the presentation
// endpoints accept and return.
type PresentationSection struct {
	ID        string         `json:"id"`
	Type      string         `json:"type" openapi:"enum=description|highlights|image_text|specifications|faq|final_cta"`
	Enabled   bool           `json:"enabled"`
	SortOrder int            `json:"sort_order"`
	Content   SectionContent `json:"content"`
}

// ListingPresentationPayload documents the structured presentation payload of
// the listing presentation GET/PUT: the canonical section envelope with
// per-type content schemas (global vs localized fields). It mirrors the
// runtime coreclient.SellerListingPresentation DTO.
type ListingPresentationPayload struct {
	SellerListingID  string                `json:"seller_listing_id"`
	SchemaVersion    int                   `json:"schema_version"`
	PurchaseBehavior string                `json:"purchase_behavior"`
	Sections         []PresentationSection `json:"sections"`
	CreatedAt        time.Time             `json:"created_at"`
	UpdatedAt        time.Time             `json:"updated_at"`
}

package api

import (
	"seller/internal/auth"
	"seller/internal/coreclient"
	"seller/internal/i18n"
	"seller/internal/markets"
)

// Bootstrap is the login-time actor bootstrap. The merchant_console block is an
// additive v1 extension (Feature 025): existing fields stay populated and
// legacy consumers are unaffected. When the actor has no Merchant Console
// integration wired (or the principal has none), the block is absent.
type Bootstrap struct {
	App              string                    `json:"app"`
	Actor            string                    `json:"actor"`
	Locale           i18n.Locale               `json:"locale"`
	Direction        string                    `json:"direction"`
	SupportedLocales []i18n.Locale             `json:"supported_locales"`
	Principal        *auth.Principal           `json:"principal,omitempty"`
	Markets          []markets.Market          `json:"markets"`
	MerchantConsole  *MerchantConsoleBootstrap `json:"merchant_console,omitempty"`
}

// MerchantConsoleBootstrap is the console context: the accessible workspaces
// resolved by Core from canonical membership records, plus the explicitly
// selected workspace echoed only after Core-side membership validation.
type MerchantConsoleBootstrap struct {
	ContractVersion string                         `json:"contract_version"`
	Workspaces      []coreclient.MerchantWorkspace `json:"workspaces"`
	Selected        *string                        `json:"selected_merchant_id,omitempty"`
}

func NewBootstrap(app, actor string, principal *auth.Principal, locale i18n.Locale, supported []i18n.Locale, marketsList []markets.Market) Bootstrap {
	return Bootstrap{
		App:              app,
		Actor:            actor,
		Locale:           locale,
		Direction:        i18n.Direction(locale),
		SupportedLocales: append([]i18n.Locale(nil), supported...),
		Principal:        principal,
		Markets:          append([]markets.Market(nil), marketsList...),
	}
}

// HasAccessibleWorkspace reports whether the principal holds an operable
// Merchant workspace.
func (b MerchantConsoleBootstrap) HasAccessibleWorkspace() bool {
	for _, ws := range b.Workspaces {
		if ws.Operable() {
			return true
		}
	}
	return false
}

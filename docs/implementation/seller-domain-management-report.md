# Seller Storefront Domain Management Implementation Report

**Stage B — Seller API Bridge + Seller Domain Management UI (Final Hardening Phase)**
**Repository**: `/var/www/personal/matjero/seller`
**Branch**: `feature/p4-custom-domain-management`
**Pull Request**: https://github.com/matjeroapps/seller/pull/11
**Seller Base SHA**: `2c1a09b61d7ac809c229c81c861392f7d6d574ac`
**Core Dependency SHA**: `96cf98e5a1f1de3f388a86e316b5b59414d49d11`

---

## 1. Overview

This report documents Stage B of the P4.8 Custom Domain Lifecycle feature in the Seller repository, including the async isolation, request form lock fix, copy timer cleanup, and domain-state privacy hardening phase.

All business capabilities (domain normalization, validation, DNS ownership verification, lifecycle transitions, activation, primary switching, and Admin disable locks) are owned authoritatively by Core over internal service HTTP calls (`/internal/v1/stores/{storeID}/domains/...`). The Seller API acts as a secure BFF bridge, forwarding authenticated actor context (`X-Matjero-Subject`) and service identity (`X-Matjero-Service: seller`).

---

## 2. Repository Independence (ADR-017)

The implementation strictly satisfies the Repository Independence Rule:
- **Zero Core Source/Build Dependency**: No Go package or struct from `github.com/matjeroapps/core` is imported.
- **Local Seller DTOs**: All DTOs are defined locally within `internal/coreclient` and `internal/sellerapi`.
- **No Shared Go Workspace**: `go.work` and `replace` directives are not used.
- **Clean Docker Builds**: Container Dockerfiles copy no files outside the repository.

---

## 3. Coreclient Methods & Public API Surface

### Coreclient Methods (`internal/coreclient/domains.go`)
- `ListStoreDomains(ctx, storeID, subject)`: `GET /internal/v1/stores/{storeID}/domains`
- `RequestCustomDomain(ctx, storeID, subject, domain)`: `POST /internal/v1/stores/{storeID}/domains`
- `VerifyCustomDomain(ctx, storeID, domainID, subject)`: `POST /internal/v1/stores/{storeID}/domains/{domainID}/verify`
- `ActivateCustomDomain(ctx, storeID, domainID, subject)`: `POST /internal/v1/stores/{storeID}/domains/{domainID}/activate`

All path identifiers (`storeID`, `domainID`) are safely URL-escaped (`url.PathEscape`).

### Public Seller API Endpoints (`internal/sellerapi/domains.go`)
- `GET /v1/seller/stores/{store_id}/domains`
- `POST /v1/seller/stores/{store_id}/domains` (Request custom domain, body: `{"domain": "..."}`)
- `POST /v1/seller/stores/{store_id}/domains/{domain_id}/verify`
- `POST /v1/seller/stores/{store_id}/domains/{domain_id}/activate`

---

## 4. Verification Challenge Privacy Policy (Server-Side Minimization)

- **Raw Verification Token Excluded**: The raw `verification_token` from Core is completely excluded from browser DTOs (`StoreDomainResponse`).
- **Server-Side Verification Payload Minimization (`toStoreDomainResponse`)**:
  - The `verification` object (`DomainVerificationResponse` containing `record_type`, `record_name`, `record_value`) is exposed **ONLY** when:
    `DomainType == "custom"` AND `(Status == "pending" || Status == "failed")` AND `Verification != nil`.
  - For `verified`, `active`, `disabled`, and `platform` domains, `verification` is set to `nil` and completely omitted from JSON responses (`"verification"` and `"record_value"` absent).
  - This ensures that inactive ownership TXT challenge secrets are not unnecessarily exposed after verification or while a domain is moderation-disabled.

---

## 5. Async Store Isolation & Form Lock Hardening (`DomainManagementPanel.tsx`)

- **Store Generation Guard (`generationRef`)**:
  - `generationRef` increments whenever `storeId` changes or a store load starts.
  - All UI state (`domains`, `storefrontHost`, `newDomain`, `isRequesting`, `formError`, `error`, `notice`, `activateTarget`, `actionDomainId`, `actionType`, `copiedKey`) is immediately reset upon store switch.
  - Resetting `isRequesting(false)` on store switch prevents an in-flight custom domain request for Store A from leaving Store B's request form stuck in a disabled/requesting state.
  - Every async operation (`loadDataForStore`, `handleRequestDomain`, `handleVerify`, `handleConfirmActivate`) captures `const currentGen = generationRef.current` and `const targetStoreId = storeId`.
  - Before mutating UI state or triggering reloads after an `await`:
    `if (currentGen !== generationRef.current || targetStoreId !== storeId) return;`
  - An out-of-order response or reload from an old store execution is cleanly ignored and cannot pollute the current store's UI.
- **Copy Timer Hygiene**:
  - Clipboard copy feedback timeout is tracked via `copyTimeoutRef` and automatically cleared upon store switch or component unmount to prevent stale feedback leakage across stores.
- **Platform Domain Actual Status Rendering**:
  - Platform domain cards display actual server status (`d.status`) rather than a hardcoded "Active".
  - If a platform domain is `disabled` by platform administration, it renders the administrative moderation notice ("This domain was disabled by platform administration and requires administrative resolution.") with no seller action buttons.
- **Centralized Status Presentation**:
  - `getStatusLabel(status)` maps status strings to localized labels consistently across both platform and custom domain cards.

---

## 6. Internationalization (i18n), RTL & Accessibility

- Full English (`en`) and Arabic (`ar`) translation dictionaries added to `locales.ts`.
- Technical values (domain names, TXT record names, record values) preserve LTR text direction (`dir="ltr"`) even within Arabic UI mode.
- Accessible form labels, keyboard navigation, ARIA live regions for async feedback, and accessible modal dialogs (`role="dialog"`, `aria-modal="true"`).

---

## 7. Supplier-Operated Store Architectural Invariant

> **Architecture Note**: A Supplier may operate as a Seller and own a Store selling their own or third-party products. However, Store ownership in Core remains strictly `Store -> seller_id` (NOT `seller_id OR supplier_id`). No `CallerSupplier` bypass or shortcut was added to domain routes. Future Supplier retail capabilities will interact through an explicit Core-owned Supplier<->Seller capability association.

---

## 8. Infrastructure Responsibility Boundaries

DNS TXT ownership verification proves domain ownership within the Matjero platform lifecycle. It does not automatically configure public DNS traffic routing or TLS certificate issuance, which remain infrastructure and edge proxy responsibilities.

---

## 9. Verification & Test Results

- **Backend Privacy Serialization Tests (`internal/sellerapi/domains_test.go`)**:
  - `TestVerificationPrivacyFiltering` covering all 6 lifecycle status and domain type combinations (pending/failed custom present, verified/active/disabled custom and platform absent).
- **Frontend Deterministic Async Race Tests (`web/seller/tests/domain-management.test.tsx`)**:
  - Added 4 mandatory deferred-promise regression tests without timing assumptions:
    1. **In-Flight Custom-Domain Request Store-Switch Test**: Request for Store A in-flight while switching to Store B; asserts Store B form is NOT stuck requesting/disabled and resolving Store A request does not mutate Store B.
    2. **Out-of-Order Load Test**: Pending load for Store A resolves after switching to Store B; Store B UI remains authoritative.
    3. **In-Flight `Verify` Switch Test**: `verifyCustomDomain` for Store A resolves after switching to Store B; Store B UI untouched.
    4. **In-Flight `Activate` Switch Test**: `activateCustomDomain` for Store A resolves after switching to Store B; Store B UI remains authoritative.
  - Disabled platform domain rendering test.
- **Go Unit Tests & Validation**: All tests pass (`GOWORK=off go test -count=1 ./...`). `gofmt`, `go vet`, `go mod tidy` 100% clean.
- **Frontend Validation**: All 39 Vitest unit/component tests pass (`npm run test`). `npm run typecheck`, `npm run lint`, `npm run build`, and `npm audit` 100% clean with 0 high/critical vulnerabilities.
- **OpenAPI**: `docs/api/seller/openapi.json` updated; `docs/api/storefront/openapi.json` completely UNCHANGED.
- **Fresh Clone & Docker**: Verified clean build outside repository tree; `seller-api` and `seller-web` (target `seller`) container images built successfully.

// Merchant Console client (Feature 025). The browser only ever talks to the
// same-origin Seller BFF; Core and the Integration Hub are never reachable from
// here. All state comes from live APIs — there is no mock or fixture data in
// production paths.

export interface MerchantWorkspaceMembership {
  id: string;
  status: 'active' | 'invited' | 'suspended';
  permissions: string[];
}

export interface MerchantWorkspaceCapability {
  status: 'inactive' | 'activating' | 'active' | 'suspended';
}

export interface MerchantWorkspaceCapabilities {
  retail?: MerchantWorkspaceCapability | null;
  supply?: MerchantWorkspaceCapability | null;
}

export interface MerchantWorkspaceStore {
  id: string;
  code: string;
  name: string;
  status: string;
  market_code: string;
}

export interface MerchantWorkspacePlanSummary {
  state: string;
}

export interface MerchantWorkspacePendingActions {
  open_review_cases: number;
  unhealthy_connections: number;
}

export interface MerchantWorkspace {
  merchant_id: string;
  merchant_code: string;
  legal_name: string;
  merchant_status: 'active' | 'suspended';
  membership: MerchantWorkspaceMembership;
  capabilities?: MerchantWorkspaceCapabilities | null;
  stores: MerchantWorkspaceStore[];
  plan_summary?: MerchantWorkspacePlanSummary | null;
  pending_actions?: MerchantWorkspacePendingActions | null;
}

export interface MerchantConsoleBootstrap {
  contract_version: string;
  workspaces: MerchantWorkspace[];
  selected_merchant_id?: string | null;
}

interface SellerBootstrapEnvelope {
  merchant_console?: MerchantConsoleBootstrap;
}

export function isOperableWorkspace(workspace: MerchantWorkspace): boolean {
  return workspace.merchant_status === 'active' && workspace.membership.status === 'active';
}

export function hasActiveCapability(
  workspace: MerchantWorkspace,
  capability: 'retail' | 'supply'
): boolean {
  return workspace.capabilities?.[capability]?.status === 'active';
}

// --- Supply module read models (live contract data) ---

export interface SupplyConnection {
  id: string;
  merchant_id: string;
  connection_type: 'SUPPLY_SOURCE' | 'RETAIL_CHANNEL';
  provider: string;
  name: string;
  status: string;
  health_status: string;
  store_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplyImportBatch {
  id: string;
  merchant_id: string;
  connection_id: string;
  provider: string;
  batch_type: string;
  status: string;
  first_import: boolean;
  record_count: number;
  approved_count: number;
  rejected_count: number;
  duplicate_count: number;
  created_at: string;
  updated_at: string;
}

export interface SupplyImportRecord {
  id: string;
  batch_id: string;
  entity_type: string;
  external_product_id: string;
  external_variant_id?: string | null;
  sku?: string | null;
  barcode?: string | null;
  title?: string | null;
  currency?: string | null;
  status: string;
  review_case_id?: string | null;
}

export interface SupplyImportBatchDetail {
  batch: SupplyImportBatch;
  records: SupplyImportRecord[];
}

export interface SupplyReviewCase {
  id: string;
  merchant_id: string;
  connection_id: string;
  case_type: string;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  reason_code: string;
  details: unknown;
  resolution?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplyMapping {
  id: string;
  merchant_id: string;
  connection_id: string;
  entity_type: string;
  internal_id: string;
  external_product_id: string;
  external_variant_id?: string | null;
  external_version?: string | null;
  authority_source: string;
  provenance: unknown;
  status: string;
  last_synced_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplyCursor {
  id: string;
  connection_id: string;
  entity_type: string;
  cursor_token?: string | null;
  last_successful_sync?: string | null;
  last_reconciled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplyFulfillmentRequest {
  id: string;
  merchant_id: string;
  connection_id: string;
  status: string;
  payload: unknown;
  external_fulfillment_id?: string | null;
  provider: string;
  created_at: string;
  updated_at: string;
}

export interface SupplyTrackingEvent {
  id: string;
  request_id: string;
  connection_id: string;
  external_event_id: string;
  status: string;
  carrier?: string | null;
  tracking_number?: string | null;
  occurred_at?: string | null;
  created_at: string;
}

export interface SupplyFulfillmentRequestDetail {
  request: SupplyFulfillmentRequest;
  tracking_events: SupplyTrackingEvent[];
}

export class MerchantConsoleError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'MerchantConsoleError';
    this.status = status;
  }
}

async function consoleRequest<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    signal,
    cache: 'no-store'
  });
  if (!response.ok) {
    let code = 'merchant_console_error';
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error?.code) {
        code = body.error.code;
        message = body.error.message || message;
      }
    } catch {
      // structured error body is optional
    }
    throw new MerchantConsoleError(message, response.status);
  }
  return response.json() as Promise<T>;
}

/**
 * Fetches the Merchant Console bootstrap. The selected workspace is carried
 * explicitly in the query string and is echoed only after server-side
 * validation — the client never assumes a default workspace.
 */
export async function fetchMerchantConsole(
  selectedMerchantId?: string,
  signal?: AbortSignal
): Promise<MerchantConsoleBootstrap> {
  const query = selectedMerchantId ? `?merchant_id=${encodeURIComponent(selectedMerchantId)}` : '';
  const response = await consoleRequest<MerchantConsoleBootstrap | SellerBootstrapEnvelope>(`/api/seller/v1/bootstrap${query}`, signal);
  if ('merchant_console' in response && response.merchant_console) {
    return response.merchant_console;
  }
  return response as MerchantConsoleBootstrap;
}

function merchantSupplyPath(merchantId: string, ...parts: string[]) {
  return `/api/seller/v1/merchants/${encodeURIComponent(merchantId)}/integrations/${parts.map(encodeURIComponent).join('/')}`;
}

export const merchantSupplyApi = {
  async listConnections(merchantId: string, signal?: AbortSignal): Promise<SupplyConnection[]> {
    return consoleRequest<SupplyConnection[]>(merchantSupplyPath(merchantId, 'connections'), signal);
  },
  async listImportBatches(
    merchantId: string,
    params: { connection_id?: string; status?: string; limit?: number; offset?: number } = {},
    signal?: AbortSignal
  ): Promise<SupplyImportBatch[]> {
    const query = new URLSearchParams();
    if (params.connection_id) query.set('connection_id', params.connection_id);
    if (params.status) query.set('status', params.status);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return consoleRequest<SupplyImportBatch[]>(merchantSupplyPath(merchantId, 'supply', 'import-batches') + suffix, signal);
  },
  async getImportBatch(merchantId: string, batchId: string, signal?: AbortSignal): Promise<SupplyImportBatchDetail> {
    return consoleRequest<SupplyImportBatchDetail>(merchantSupplyPath(merchantId, 'supply', 'import-batches', batchId), signal);
  },
  async listReviewCases(
    merchantId: string,
    params: { connection_id?: string; status?: string } = {},
    signal?: AbortSignal
  ): Promise<SupplyReviewCase[]> {
    const query = new URLSearchParams();
    if (params.connection_id) query.set('connection_id', params.connection_id);
    if (params.status) query.set('status', params.status);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return consoleRequest<SupplyReviewCase[]>(merchantSupplyPath(merchantId, 'supply', 'review-cases') + suffix, signal);
  },
  async getReviewCase(merchantId: string, caseId: string, signal?: AbortSignal): Promise<SupplyReviewCase> {
    return consoleRequest<SupplyReviewCase>(merchantSupplyPath(merchantId, 'supply', 'review-cases', caseId), signal);
  },
  async listMappings(merchantId: string, connectionId?: string, signal?: AbortSignal): Promise<SupplyMapping[]> {
    const suffix = connectionId ? `?connection_id=${encodeURIComponent(connectionId)}` : '';
    return consoleRequest<SupplyMapping[]>(merchantSupplyPath(merchantId, 'supply', 'mappings') + suffix, signal);
  },
  async listCursors(merchantId: string, connectionId?: string, signal?: AbortSignal): Promise<SupplyCursor[]> {
    const suffix = connectionId ? `?connection_id=${encodeURIComponent(connectionId)}` : '';
    return consoleRequest<SupplyCursor[]>(merchantSupplyPath(merchantId, 'supply', 'cursors') + suffix, signal);
  },
  async listFulfillmentRequests(
    merchantId: string,
    params: { connection_id?: string; status?: string; limit?: number; offset?: number } = {},
    signal?: AbortSignal
  ): Promise<SupplyFulfillmentRequest[]> {
    const query = new URLSearchParams();
    if (params.connection_id) query.set('connection_id', params.connection_id);
    if (params.status) query.set('status', params.status);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return consoleRequest<SupplyFulfillmentRequest[]>(merchantSupplyPath(merchantId, 'supply', 'fulfillment-requests') + suffix, signal);
  },
  async getFulfillmentRequest(
    merchantId: string,
    requestId: string,
    signal?: AbortSignal
  ): Promise<SupplyFulfillmentRequestDetail> {
    return consoleRequest<SupplyFulfillmentRequestDetail>(merchantSupplyPath(merchantId, 'supply', 'fulfillment-requests', requestId), signal);
  }
};

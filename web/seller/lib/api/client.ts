import type {
  ApiKey,
  CreateShipmentPayload,
  ExternalEntityMapping,
  InitializePaymentPayload,
  IntegrationConnection,
  InventorySnapshot,
  LedgerEntry,
  MediaPresignResponse,
  Payment,
  Payout,
  Product,
  ProductMediaReference,
  OrderTransitionPayload,
  SellerListing,
  SellerOrder,
  SellerOrderDetail,
  SellerOrderListResponse,
  SellerStoreListResponse,
  SellerSyncJob,
  Settlement,
  Shipment,
  Store,
  StoreBalance,
  StoreMediaAsset,
  StoreOperationalState,
  StructuredPublishReadiness,
  SupplierCatalogItem,
  Theme,
  ThemeInstallationResponse,
  UpdatePaymentStatusPayload,
  UpdateShipmentStatusPayload,
  WebhookSubscription
} from './types';

const SELLER_API_BASE_URL = process.env.NEXT_PUBLIC_SELLER_API_BASE_URL || 'http://127.0.0.1:18081';

function getBaseUrl() {
  return typeof window === 'undefined' ? SELLER_API_BASE_URL : '/api/seller';
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (!response.ok) {
    let errCode = 'unknown_error';
    let errMessage = `HTTP request failed with status ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody?.error?.code) {
        errCode = errBody.error.code;
        errMessage = errBody.error.message || errCode;
      }
    } catch {
      // ignore parse error
    }
    throw new ApiError(errCode, errMessage, response.status);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const sellerApi = {
  // Store management
  async getStores(): Promise<SellerStoreListResponse> {
    return request<SellerStoreListResponse>('/v1/seller/stores');
  },

  async createStore(data: { name: string; code: string; market_code: string; status?: string }): Promise<Store> {
    return request<Store>('/v1/seller/stores', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateStoreStatus(storeId: string, status: string): Promise<Store> {
    return request<Store>(`/v1/seller/stores/${encodeURIComponent(storeId)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
  },

  async getStorefrontHost(storeId: string): Promise<{ host: string }> {
    return request<{ host: string }>(`/v1/seller/stores/${encodeURIComponent(storeId)}/storefront-host`);
  },

  async getStoreOperationalState(storeId: string): Promise<StoreOperationalState> {
    return request<StoreOperationalState>(`/v1/seller/stores/${encodeURIComponent(storeId)}/operational-state`);
  },

  async updateStoreOperationalState(
    storeId: string,
    data: { checkout_status: 'accepting' | 'paused'; maintenance_message?: string }
  ): Promise<StoreOperationalState> {
    return request<StoreOperationalState>(`/v1/seller/stores/${encodeURIComponent(storeId)}/operational-state`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Themes
  async listThemes(): Promise<{ items: Theme[] }> {
    return request<{ items: Theme[] }>('/v1/seller/themes');
  },

  async getThemeVersions(themeKey: string): Promise<{ items: import('./types').ThemeVersion[] }> {
    return request<{ items: import('./types').ThemeVersion[] }>(`/v1/seller/themes/${encodeURIComponent(themeKey)}/versions`);
  },

  async getThemeInstallation(storeId: string): Promise<ThemeInstallationResponse> {
    return request<ThemeInstallationResponse>(`/v1/seller/stores/${encodeURIComponent(storeId)}/theme`);
  },

  async installTheme(storeId: string, data: { theme_key: string; version?: string }): Promise<ThemeInstallationResponse> {
    return request<ThemeInstallationResponse>(`/v1/seller/stores/${encodeURIComponent(storeId)}/theme/install`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getThemeDraft(storeId: string): Promise<import('./types').ThemeDraftResponse> {
    return request<import('./types').ThemeDraftResponse>(`/v1/seller/stores/${encodeURIComponent(storeId)}/theme/draft`);
  },

  async updateThemeDraft(storeId: string, config: Record<string, unknown>): Promise<import('./types').ThemeDraftResponse> {
    return request<import('./types').ThemeDraftResponse>(`/v1/seller/stores/${encodeURIComponent(storeId)}/theme/draft`, {
      method: 'PUT',
      body: JSON.stringify({ config })
    });
  },

  async publishTheme(storeId: string): Promise<import('./types').ThemePublishResponse> {
    return request<import('./types').ThemePublishResponse>(`/v1/seller/stores/${encodeURIComponent(storeId)}/theme/publish`, {
      method: 'POST'
    });
  },

  async discardThemeDraft(storeId: string): Promise<import('./types').ThemeDraftResponse> {
    return request<import('./types').ThemeDraftResponse>(`/v1/seller/stores/${encodeURIComponent(storeId)}/theme/discard`, {
      method: 'POST'
    });
  },

  async createThemePreview(storeId: string): Promise<import('./types').ThemePreviewResponse> {
    return request<import('./types').ThemePreviewResponse>(`/v1/seller/stores/${encodeURIComponent(storeId)}/theme/preview`, {
      method: 'POST'
    });
  },

  // Supplier offers
  async listStoreSupplierOffers(storeId: string, query?: string): Promise<{ items: SupplierCatalogItem[] }> {
    const q = query ? `?query=${encodeURIComponent(query)}` : '';
    return request<{ items: SupplierCatalogItem[] }>(`/v1/seller/stores/${encodeURIComponent(storeId)}/supplier-offers${q}`);
  },

  async importSupplierOffer(storeId: string, offerId: string): Promise<SellerListing> {
    return request<SellerListing>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/supplier-offers/${encodeURIComponent(offerId)}/imports`,
      { method: 'POST' }
    );
  },

  // Products & Listings
  async listStoreProducts(storeId: string): Promise<{ items: Product[] }> {
    return request<{ items: Product[] }>(`/v1/seller/stores/${encodeURIComponent(storeId)}/products`);
  },

  async createStoreProduct(storeId: string, data: { name: string; slug: string; category_id?: string }): Promise<Product> {
    return request<Product>(`/v1/seller/stores/${encodeURIComponent(storeId)}/products`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateProductStatus(storeId: string, productId: string, status: string): Promise<Product> {
    return request<Product>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/status`,
      {
        method: 'POST',
        body: JSON.stringify({ status })
      }
    );
  },

  async archiveProduct(storeId: string, productId: string): Promise<Product> {
    return request<Product>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/archive`,
      { method: 'POST' }
    );
  },

  async listStoreListings(storeId: string): Promise<{ items: SellerListing[] }> {
    return request<{ items: SellerListing[] }>(`/v1/seller/stores/${encodeURIComponent(storeId)}/listings`);
  },

  async getStoreListing(storeId: string, listingId: string): Promise<SellerListing> {
    return request<SellerListing>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/listings/${encodeURIComponent(listingId)}`
    );
  },

  async getStoreListingLifecycle(storeId: string, listingId: string): Promise<import('./types').SellerListingLifecycle> {
    return request<import('./types').SellerListingLifecycle>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/listings/${encodeURIComponent(listingId)}/lifecycle`
    );
  },

  async updateListingPrice(storeId: string, listingId: string, price: { currency: string; amount: number }): Promise<SellerListing> {
    return request<SellerListing>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/listings/${encodeURIComponent(listingId)}/price`,
      {
        method: 'PUT',
        body: JSON.stringify({ price })
      }
    );
  },

  async getListingReadiness(storeId: string, listingId: string): Promise<StructuredPublishReadiness> {
    return request<StructuredPublishReadiness>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/listings/${encodeURIComponent(listingId)}/readiness`
    );
  },

  async publishListing(storeId: string, listingId: string): Promise<SellerListing> {
    return request<SellerListing>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/listings/${encodeURIComponent(listingId)}/publish`,
      { method: 'POST' }
    );
  },

  async unpublishListing(storeId: string, listingId: string): Promise<SellerListing> {
    return request<SellerListing>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/listings/${encodeURIComponent(listingId)}/unpublish`,
      { method: 'POST' }
    );
  },

  async archiveListing(storeId: string, listingId: string): Promise<SellerListing> {
    return request<SellerListing>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/listings/${encodeURIComponent(listingId)}/archive`,
      { method: 'POST' }
    );
  },

  // Media Library
  async listStoreMedia(storeId: string): Promise<{ items: StoreMediaAsset[] }> {
    return request<{ items: StoreMediaAsset[] }>(`/v1/seller/stores/${encodeURIComponent(storeId)}/media`);
  },

  async createMediaUpload(
    storeId: string,
    data: { client_upload_id: string; filename: string; content_type: string; size_bytes: number; checksum_sha256: string }
  ): Promise<MediaPresignResponse> {
    return request<MediaPresignResponse>(`/v1/seller/stores/${encodeURIComponent(storeId)}/media/uploads`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async completeMediaUpload(storeId: string, intentId: string, uploadToken: string): Promise<StoreMediaAsset> {
    return request<StoreMediaAsset>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/media/uploads/${encodeURIComponent(intentId)}/complete`,
      {
        method: 'POST',
        body: JSON.stringify({ upload_token: uploadToken })
      }
    );
  },

  async deleteStoreMedia(storeId: string, assetId: string): Promise<void> {
    return request<void>(`/v1/seller/stores/${encodeURIComponent(storeId)}/media/${encodeURIComponent(assetId)}`, {
      method: 'DELETE'
    });
  },

  async attachProductMedia(
    storeId: string,
    productId: string,
    data: { asset_id: string; alt_text?: string; sort_order?: number; is_primary?: boolean }
  ): Promise<ProductMediaReference> {
    return request<ProductMediaReference>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/media-references`,
      {
        method: 'POST',
        body: JSON.stringify(data)
      }
    );
  },

  async updateProductMediaReference(
    storeId: string,
    productId: string,
    referenceId: string,
    data: { alt_text?: string; sort_order?: number; is_primary?: boolean }
  ): Promise<ProductMediaReference> {
    return request<ProductMediaReference>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/media-references/${encodeURIComponent(referenceId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(data)
      }
    );
  },

  async detachProductMedia(storeId: string, productId: string, referenceId: string): Promise<void> {
    return request<void>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/media-references/${encodeURIComponent(referenceId)}`,
      { method: 'DELETE' }
    );
  },

  // Inventory
  async listStoreInventory(storeId: string): Promise<{ items: InventorySnapshot[] }> {
    return request<{ items: InventorySnapshot[] }>(`/v1/seller/stores/${encodeURIComponent(storeId)}/inventory`);
  },

  async adjustInventory(
    storeId: string,
    data: { fulfillment_location_id: string; sku_id: string; qty_delta: number; idempotency_key?: string }
  ): Promise<InventorySnapshot> {
    return request<InventorySnapshot>(`/v1/seller/stores/${encodeURIComponent(storeId)}/inventory/adjustments`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Shipping
  // Orders
  async listStoreOrders(
    storeId: string,
    params: { status?: string; limit?: number; offset?: number; query?: string } = {}
  ): Promise<SellerOrderListResponse> {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'all') query.set('status', params.status);
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.offset) query.set('offset', params.offset.toString());
    if (params.query) query.set('query', params.query);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<SellerOrderListResponse>(`/v1/seller/stores/${encodeURIComponent(storeId)}/orders${qs}`);
  },

  async getStoreOrderDetail(storeId: string, orderId: string): Promise<SellerOrderDetail> {
    return request<SellerOrderDetail>(`/v1/seller/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(orderId)}`);
  },

  async transitionStoreOrder(storeId: string, orderId: string, data: OrderTransitionPayload): Promise<SellerOrderDetail> {
    return request<SellerOrderDetail>(`/v1/seller/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(orderId)}/transition`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async createShipment(storeId: string, orderId: string, data: CreateShipmentPayload): Promise<Shipment> {
    return request<Shipment>(`/v1/seller/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(orderId)}/shipments`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async listOrderShipments(storeId: string, orderId: string): Promise<{ shipments: Shipment[] }> {
    return request<{ shipments: Shipment[] }>(`/v1/seller/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(orderId)}/shipments`);
  },

  async getShipment(storeId: string, shipmentId: string): Promise<Shipment> {
    return request<Shipment>(`/v1/seller/stores/${encodeURIComponent(storeId)}/shipments/${encodeURIComponent(shipmentId)}`);
  },

  async updateShipmentStatus(storeId: string, shipmentId: string, data: UpdateShipmentStatusPayload): Promise<Shipment> {
    return request<Shipment>(`/v1/seller/stores/${encodeURIComponent(storeId)}/shipments/${encodeURIComponent(shipmentId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  // Payments
  async initializeOrderPayment(storeId: string, orderId: string, data: InitializePaymentPayload): Promise<Payment> {
    return request<Payment>(`/v1/seller/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(orderId)}/payments`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getOrderPayment(storeId: string, orderId: string): Promise<Payment> {
    return request<Payment>(`/v1/seller/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(orderId)}/payments`);
  },

  async getPayment(storeId: string, paymentId: string): Promise<Payment> {
    return request<Payment>(`/v1/seller/stores/${encodeURIComponent(storeId)}/payments/${encodeURIComponent(paymentId)}`);
  },

  async updatePaymentStatus(storeId: string, paymentId: string, data: UpdatePaymentStatusPayload): Promise<Payment> {
    return request<Payment>(`/v1/seller/stores/${encodeURIComponent(storeId)}/payments/${encodeURIComponent(paymentId)}/status`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Finance & Ledger
  async getStoreBalance(storeId: string): Promise<StoreBalance> {
    return request<StoreBalance>(`/v1/seller/stores/${encodeURIComponent(storeId)}/finance/balance`);
  },

  async listStoreLedgerEntries(storeId: string): Promise<{ items: LedgerEntry[] }> {
    return request<{ items: LedgerEntry[] }>(`/v1/seller/stores/${encodeURIComponent(storeId)}/finance/ledger`);
  },

  async listStoreSettlements(storeId: string): Promise<{ items: Settlement[] }> {
    return request<{ items: Settlement[] }>(`/v1/seller/stores/${encodeURIComponent(storeId)}/finance/settlements`);
  },

  async listStorePayouts(storeId: string): Promise<{ items: Payout[] }> {
    return request<{ items: Payout[] }>(`/v1/seller/stores/${encodeURIComponent(storeId)}/finance/payouts`);
  },

  // Integrations
  async listStoreConnections(storeId: string): Promise<{ items: IntegrationConnection[] }> {
    return request<{ items: IntegrationConnection[] }>(`/v1/seller/stores/${encodeURIComponent(storeId)}/integrations/connections`);
  },

  async createStoreConnection(storeId: string, data: { provider: string; name: string; credentials_vault_ref?: string; settings?: Record<string, unknown> }): Promise<IntegrationConnection> {
    return request<IntegrationConnection>(`/v1/seller/stores/${encodeURIComponent(storeId)}/integrations/connections`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async listStoreEntityMappings(storeId: string, connectionId: string, entityType: string): Promise<{ items: ExternalEntityMapping[] }> {
    return request<{ items: ExternalEntityMapping[] }>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/integrations/mappings?connection_id=${encodeURIComponent(connectionId)}&entity_type=${encodeURIComponent(entityType)}`
    );
  },

  async listStoreSyncJobs(storeId: string): Promise<{ items: SellerSyncJob[] }> {
    return request<{ items: SellerSyncJob[] }>(`/v1/seller/stores/${encodeURIComponent(storeId)}/integrations/sync-jobs`);
  },

  async createStoreSyncJob(storeId: string, data: { connection_id: string; sync_type?: string }): Promise<SellerSyncJob> {
    return request<SellerSyncJob>(`/v1/seller/stores/${encodeURIComponent(storeId)}/integrations/sync-jobs`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // API Keys & Webhooks
  async listStoreAPIKeys(storeId: string): Promise<{ items: ApiKey[] }> {
    return request<{ items: ApiKey[] }>(`/v1/seller/stores/${encodeURIComponent(storeId)}/integrations/api-keys`);
  },

  async createStoreAPIKey(storeId: string, data: { name: string; scopes?: string[] }): Promise<ApiKey> {
    return request<ApiKey>(`/v1/seller/stores/${encodeURIComponent(storeId)}/integrations/api-keys`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async revokeStoreAPIKey(storeId: string, keyId: string): Promise<ApiKey> {
    return request<ApiKey>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/integrations/api-keys/${encodeURIComponent(keyId)}/revoke`,
      { method: 'POST' }
    );
  },

  async listStoreWebhookSubscriptions(storeId: string): Promise<{ items: WebhookSubscription[] }> {
    return request<{ items: WebhookSubscription[] }>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/integrations/webhooks`
    );
  },

  async createStoreWebhookSubscription(
    storeId: string,
    data: { target_url: string; subscribed_events: string[] }
  ): Promise<WebhookSubscription> {
    return request<WebhookSubscription>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/integrations/webhooks`,
      {
        method: 'POST',
        body: JSON.stringify(data)
      }
    );
  },

  async deleteStoreWebhookSubscription(storeId: string, subscriptionId: string): Promise<void> {
    return request<void>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/integrations/webhooks/${encodeURIComponent(subscriptionId)}`,
      { method: 'DELETE' }
    );
  }
};


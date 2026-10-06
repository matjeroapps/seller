import type {
  ApiKey,
  CreateProductVariantPayload,
  CreateShipmentPayload,
  CreateStoreShipmentPayload,
  ExternalEntityMapping,
  InitializePaymentPayload,
  IntegrationConnection,
  InventoryAdjustmentPayload,
  InventoryAdjustmentResponse,
  InventorySnapshot,
  LedgerEntry,
  MediaPresignResponse,
  Payment,
  Payout,
  Product,
  ProductMediaReference,
  ProductSku,
  ProductTranslation,
  ProductVariant,
  OrderTransitionPayload,
  SellerListing,
  SellerCategory,
  StoreCategory,
  StoreCategoryInput,
  StoreCategoryUpdateInput,
  StoreCategoryReorderEntry,
  SellerProductDetail,
  SellerOrder,
  SellerOrderDetail,
  SellerOrderListResponse,
  SellerProfile,
  SellerStoreListResponse,
  SellerSyncJob,
  Settlement,
  Shipment,
  Store,
  StoreBalance,
  StoreShipmentsResponse,
  StoreLocation,
  StoreMediaAsset,
  StoreOperationalState,
  StructuredPublishReadiness,
  SupplierCatalogItem,
  Theme,
  ThemeInstallationResponse,
  UpdatePaymentStatusPayload,
  UpdateSellerProfilePayload,
  UpdateShipmentStatusPayload,
  WebhookSubscription
} from './types';

const SELLER_API_BASE_URL = process.env.NEXT_PUBLIC_SELLER_API_BASE_URL || 'http://127.0.0.1:18081';

function getBaseUrl() {
  return typeof window === 'undefined' ? SELLER_API_BASE_URL : '/api/seller';
}

type SellerProductListPayload = {
  products?: Array<{
    product?: {
      id?: string;
      slug?: string;
      status?: string;
      created_at?: string;
      updated_at?: string;
    };
    source?: string;
    name?: string;
  }>;
  items?: Product[];
};

function productFromDetail(detail: SellerProductDetail, storeId: string): Product {
  const primaryTranslation =
    detail.translations.find((translation) => translation.locale === 'en') ||
    detail.translations[0];

  return {
    id: detail.product.id,
    store_id: storeId,
    source: detail.source === 'supplier_backed' ? 'supplier_backed' : 'seller_owned',
    slug: detail.product.slug,
    name: primaryTranslation?.name || detail.product.slug || 'Unnamed product',
    status: (detail.product.status || 'draft') as Product['status'],
    created_at: detail.product.created_at,
    updated_at: detail.product.updated_at
  };
}

type CollectionPayload<T> = { items?: T[] | null } | T[] | null;

function normalizeItems<T>(payload: CollectionPayload<T> | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.items) ? payload.items : [];
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
      if (typeof errBody?.error === 'object' && errBody?.error?.code) {
        errCode = errBody.error.code;
        errMessage = errBody.error.message || errCode;
      } else if (typeof errBody?.error === 'string') {
        errCode = errBody.error;
        errMessage = errBody.message || errCode;
      } else if (errBody?.message) {
        errMessage = errBody.message;
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
    const payload = await request<SellerStoreListResponse | null>('/v1/seller/stores');
    return {
      items: payload?.items || [],
      active_store_limit: payload?.active_store_limit || 0,
      active_store_count: payload?.active_store_count || 0
    };
  },

  async ensureRetailWorkspace(data: { code: string; legal_name: string }): Promise<{ id: string; code: string; legal_name: string; status: string }> {
    return request('/v1/merchants/self/retail-workspace', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async createStore(data: { name: string; code: string; market_code: string; status?: string; merchant_id?: string }): Promise<Store> {
    const { merchant_id, ...payload } = data;
    const path = merchant_id ? `/v1/merchants/${encodeURIComponent(merchant_id)}/stores` : '/v1/seller/stores';
    return request<Store>(path, {
      method: 'POST',
      body: JSON.stringify(payload)
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

  async importSupplierOffer(
    storeId: string,
    offerId: string,
    params?: import('./types').SupplierOfferImportParams
  ): Promise<SellerListing> {
    return request<SellerListing>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/supplier-offers/${encodeURIComponent(offerId)}/imports`,
      {
        method: 'POST',
        ...(params ? { body: JSON.stringify(params) } : {})
      }
    );
  },

  // Products & Listings
  async listStoreProducts(storeId: string): Promise<{ items: Product[] }> {
    const payload = await request<SellerProductListPayload | null>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/products`
    );

    if (Array.isArray(payload?.items)) {
      return { items: payload.items };
    }

    return {
      items: (payload?.products || []).map((row) => ({
        id: row.product?.id || row.name || 'unknown-product',
        store_id: storeId,
        source: row.source === 'supplier_backed' ? 'supplier_backed' : 'seller_owned',
        slug: row.product?.slug || '',
        name: row.name || row.product?.slug || 'Unnamed product',
        status: (row.product?.status || 'draft') as Product['status'],
        created_at: row.product?.created_at || '',
        updated_at: row.product?.updated_at || ''
      }))
    };
  },

  async listStoreCategories(
    storeId: string,
    options: { status?: string; limit?: number; offset?: number } = {}
  ): Promise<StoreCategory[]> {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    params.set('limit', String(options.limit ?? 100));
    if (options.offset) params.set('offset', String(options.offset));
    const payload = await request<{ items?: StoreCategory[] } | StoreCategory[]>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/categories?${params.toString()}`
    );
    return normalizeItems(payload);
  },

  async createStoreCategory(storeId: string, input: StoreCategoryInput): Promise<StoreCategory> {
    return request<StoreCategory>(`/v1/seller/stores/${encodeURIComponent(storeId)}/categories`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  async getStoreCategory(storeId: string, categoryId: string): Promise<StoreCategory> {
    return request<StoreCategory>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/categories/${encodeURIComponent(categoryId)}`
    );
  },

  async updateStoreCategory(
    storeId: string,
    categoryId: string,
    input: StoreCategoryUpdateInput
  ): Promise<StoreCategory> {
    return request<StoreCategory>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/categories/${encodeURIComponent(categoryId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(input)
      }
    );
  },

  async updateStoreCategoryStatus(storeId: string, categoryId: string, status: string): Promise<StoreCategory> {
    return request<StoreCategory>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/categories/${encodeURIComponent(categoryId)}/status`,
      {
        method: 'POST',
        body: JSON.stringify({ status })
      }
    );
  },

  async deleteStoreCategory(storeId: string, categoryId: string): Promise<{ status: string }> {
    return request<{ status: string }>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/categories/${encodeURIComponent(categoryId)}`,
      { method: 'DELETE' }
    );
  },

  async reorderStoreCategories(
    storeId: string,
    order: StoreCategoryReorderEntry[]
  ): Promise<{ status: string }> {
    return request<{ status: string }>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/categories/reorder`,
      {
        method: 'POST',
        body: JSON.stringify({ order })
      }
    );
  },

  async createStoreProduct(storeId: string, data: { name: string; slug: string; category_id?: string }): Promise<Product> {
    const detail = await request<SellerProductDetail>(`/v1/seller/stores/${encodeURIComponent(storeId)}/products`, {
      method: 'POST',
      body: JSON.stringify({
        slug: data.slug,
        translations: [{ locale: 'en', name: data.name, description: '' }],
        category_ids: data.category_id ? [data.category_id] : []
      })
    });
    return productFromDetail(detail, storeId);
  },

  async getStoreProductDetail(storeId: string, productId: string): Promise<SellerProductDetail> {
    return request<SellerProductDetail>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}`
    );
  },

  async updateStoreProduct(
    storeId: string,
    productId: string,
    data: { slug: string; translations: ProductTranslation[]; category_ids?: string[] }
  ): Promise<SellerProductDetail> {
    return request<SellerProductDetail>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          slug: data.slug,
          translations: data.translations,
          category_ids: data.category_ids || []
        })
      }
    );
  },

  async updateProductStatus(storeId: string, productId: string, status: string): Promise<{ status: string }> {
    return request<{ status: string }>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/status`,
      {
        method: 'POST',
        body: JSON.stringify({ status })
      }
    );
  },

  async archiveProduct(storeId: string, productId: string): Promise<{ status: string }> {
    return request<{ status: string }>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/archive`,
      { method: 'POST' }
    );
  },

  async createProductVariant(
    storeId: string,
    productId: string,
    data: CreateProductVariantPayload | { code: string; status: string }
  ): Promise<ProductVariant> {
    return request<ProductVariant>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/variants`,
      {
        method: 'POST',
        body: JSON.stringify(data)
      }
    );
  },

  async updateProductVariant(
    storeId: string,
    productId: string,
    variantId: string,
    data: { code: string; status: string }
  ): Promise<ProductVariant> {
    return request<ProductVariant>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(data)
      }
    );
  },

  async createProductSku(
    storeId: string,
    productId: string,
    variantId: string,
    data: { code: string; barcode?: string; status: string }
  ): Promise<ProductSku> {
    return request<ProductSku>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/skus`,
      {
        method: 'POST',
        body: JSON.stringify({
          code: data.code,
          barcode: data.barcode || null,
          status: data.status
        })
      }
    );
  },

  async updateProductSku(
    storeId: string,
    productId: string,
    variantId: string,
    skuId: string,
    data: { code: string; barcode?: string; status: string }
  ): Promise<ProductSku> {
    return request<ProductSku>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/skus/${encodeURIComponent(skuId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          code: data.code,
          barcode: data.barcode || null,
          status: data.status
        })
      }
    );
  },

  async listStoreListings(storeId: string): Promise<{ items: SellerListing[] }> {
    const payload = await request<CollectionPayload<SellerListing>>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/listings`
    );
    return { items: normalizeItems(payload) };
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

  /** Sets the retail price. `amount_minor` is in minor units (e.g. halalas). */
  async updateListingPrice(
    storeId: string,
    listingId: string,
    price: import('./types').ListingPriceUpdateRequest
  ): Promise<{ status: string }> {
    return request<{ status: string }>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/listings/${encodeURIComponent(listingId)}/price`,
      {
        method: 'PUT',
        body: JSON.stringify({
          amount_minor: price.retail_price_minor_units ?? price.amount_minor,
          currency: price.currency,
          retail_price_minor_units: price.retail_price_minor_units,
          allow_sub_wholesale: price.allow_sub_wholesale,
          audit_reason: price.audit_reason
        })
      }
    );
  },

  async setStoreListingPrice(
    storeId: string,
    listingId: string,
    price: import('./types').ListingPriceUpdateRequest
  ): Promise<{ status: string }> {
    return this.updateListingPrice(storeId, listingId, price);
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
    const res = await request<{ items?: StoreMediaAsset[]; assets?: StoreMediaAsset[] }>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/media`
    );
    return { items: res.items || res.assets || [] };
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

  async listProductMediaReferences(storeId: string, productId: string): Promise<{ items: ProductMediaReference[] }> {
    const payload = await request<{ references?: ProductMediaReference[] | null; items?: ProductMediaReference[] | null } | ProductMediaReference[] | null>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/media-references`
    );
    if (Array.isArray(payload)) {
      return { items: payload };
    }
    return { items: Array.isArray(payload?.references) ? payload.references : Array.isArray(payload?.items) ? payload.items : [] };
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

  // Inventory & Locations
  async listStoreLocations(storeId: string): Promise<{ items: StoreLocation[] }> {
    const payload = await request<{ locations?: StoreLocation[]; items?: StoreLocation[] } | StoreLocation[] | null>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/locations`
    );
    if (Array.isArray(payload)) {
      return { items: payload };
    }
    return {
      items: Array.isArray(payload?.locations)
        ? payload.locations
        : Array.isArray(payload?.items)
          ? payload.items
          : []
    };
  },

  async listStoreInventory(storeId: string): Promise<{ items: InventorySnapshot[] }> {
    const payload = await request<
      | { items?: InventorySnapshot[] | null; inventory?: InventorySnapshot[] | null }
      | InventorySnapshot[]
      | null
    >(`/v1/seller/stores/${encodeURIComponent(storeId)}/inventory`);

    if (Array.isArray(payload)) {
      return { items: payload };
    }

    return {
      items: Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.inventory)
          ? payload.inventory
          : []
    };
  },

  async adjustInventory(
    storeId: string,
    data: InventoryAdjustmentPayload
  ): Promise<InventoryAdjustmentResponse> {
    const { idempotency_key, ...body } = data;
    const headers: Record<string, string> = {};
    if (idempotency_key) {
      headers['Idempotency-Key'] = idempotency_key;
    }
    return request<InventoryAdjustmentResponse>(`/v1/seller/stores/${encodeURIComponent(storeId)}/inventory/adjustments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
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

  async listStoreShipments(
    storeId: string,
    params?: { status?: string; page?: number; limit?: number; page_size?: number }
  ): Promise<StoreShipmentsResponse> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.page_size || params?.limit) query.set('limit', String(params?.page_size || params?.limit));
    const qs = query.toString();
    return request<StoreShipmentsResponse>(
      `/v1/seller/stores/${encodeURIComponent(storeId)}/shipments${qs ? `?${qs}` : ''}`
    );
  },

  async createStoreShipment(
    storeId: string,
    data: CreateStoreShipmentPayload
  ): Promise<Shipment> {
    return request<Shipment>(`/v1/seller/stores/${encodeURIComponent(storeId)}/shipments`, {
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
  },

  // Account Profile
  async getProfile(): Promise<SellerProfile> {
    const payload = await request<
      | SellerProfile
      | {
          seller?: {
            id?: string;
            code?: string;
            name?: string;
            status?: string;
            created_at?: string;
            updated_at?: string;
          };
          settings?: Record<string, unknown> | null;
        }
    >('/v1/seller/profile');

    if ('seller' in payload && payload.seller) {
      const phone = typeof payload.settings?.phone === 'string' ? payload.settings.phone : undefined;
      return {
        id: payload.seller.id || '',
        code: payload.seller.code,
        name: payload.seller.name || '',
        status: payload.seller.status,
        phone,
        roles: [],
        settings: payload.settings || {},
        created_at: payload.seller.created_at,
        updated_at: payload.seller.updated_at
      };
    }

    const profilePayload = payload as SellerProfile;
    return {
      ...profilePayload,
      roles: profilePayload.roles || [],
      settings: profilePayload.settings || {}
    };
  },

  async updateProfile(data: UpdateSellerProfilePayload): Promise<{ status: string }> {
    const settings = {
      ...(data.settings || {}),
      ...(data.phone ? { phone: data.phone } : {})
    };

    return request<{ status: string }>('/v1/seller/profile', {
      method: 'PUT',
      body: JSON.stringify({
        name: data.name,
        status: data.status || 'active',
        settings
      }),
    });
  }
};

export const sellerClient = sellerApi;

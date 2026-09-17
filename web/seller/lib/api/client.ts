import type {
  InventorySnapshot,
  MediaPresignResponse,
  Product,
  ProductMediaReference,
  SellerListing,
  SellerStoreListResponse,
  Store,
  StoreMediaAsset,
  StructuredPublishReadiness,
  SupplierCatalogItem
} from './types';

const BASE_URL = process.env.NEXT_PUBLIC_SELLER_API_BASE_URL || 'http://127.0.0.1:18081';

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

  const response = await fetch(`${BASE_URL}${path}`, {
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
  }
};

export type ApiConfig = {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null>;
  renewToken?: () => Promise<string | null>;
  onUnauthorized?: () => void;
  onForbidden?: () => void;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createApiClient(config: ApiConfig) {
  async function request(method: string, path: string, body?: unknown): Promise<Response> {
    let token = await config.getAccessToken?.();

    const execute = async (authToken: string | null) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      return fetch(new URL(path, config.baseUrl), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    };

    let response = await execute(token ?? null);

    if (response.status === 401) {
      // Attempt renewal once
      const renewedToken = config.renewToken ? await config.renewToken() : await config.getAccessToken?.();
      if (renewedToken) {
        response = await execute(renewedToken);
      }
      if (response.status === 401) {
        config.onUnauthorized?.();
      } else if (response.status === 403) {
        config.onForbidden?.();
      }
    } else if (response.status === 403) {
      config.onForbidden?.();
    }

    return response;
  }

  return {
    async get(path: string): Promise<Response> {
      return request('GET', path);
    },
    async post(path: string, body?: unknown): Promise<Response> {
      return request('POST', path, body);
    },
    async put(path: string, body?: unknown): Promise<Response> {
      return request('PUT', path, body);
    },
    async delete(path: string): Promise<Response> {
      return request('DELETE', path);
    },
    async listStoreDomains(storeId: string) {
      const res = await request('GET', `/v1/seller/stores/${encodeURIComponent(storeId)}/domains`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: { code: 'unknown', message: 'Failed to list domains' } }));
        throw new ApiError(res.status, payload.error?.code || 'unknown', payload.error?.message || 'Failed to list domains');
      }
      return res.json();
    },
    async requestCustomDomain(storeId: string, domain: string) {
      const res = await request('POST', `/v1/seller/stores/${encodeURIComponent(storeId)}/domains`, { domain });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: { code: 'unknown', message: 'Failed to request domain' } }));
        throw new ApiError(res.status, payload.error?.code || 'unknown', payload.error?.message || 'Failed to request domain');
      }
      return res.json();
    },
    async verifyCustomDomain(storeId: string, domainId: string) {
      const res = await request('POST', `/v1/seller/stores/${encodeURIComponent(storeId)}/domains/${encodeURIComponent(domainId)}/verify`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: { code: 'unknown', message: 'Failed to verify domain' } }));
        throw new ApiError(res.status, payload.error?.code || 'unknown', payload.error?.message || 'Failed to verify domain');
      }
      return res.json();
    },
    async activateCustomDomain(storeId: string, domainId: string) {
      const res = await request('POST', `/v1/seller/stores/${encodeURIComponent(storeId)}/domains/${encodeURIComponent(domainId)}/activate`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: { code: 'unknown', message: 'Failed to activate domain' } }));
        throw new ApiError(res.status, payload.error?.code || 'unknown', payload.error?.message || 'Failed to activate domain');
      }
      return res.json();
    },
    async getStorefrontHost(storeId: string) {
      const res = await request('GET', `/v1/seller/stores/${encodeURIComponent(storeId)}/storefront-host`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: { code: 'unknown', message: 'Failed to get storefront host' } }));
        throw new ApiError(res.status, payload.error?.code || 'unknown', payload.error?.message || 'Failed to get storefront host');
      }
      return res.json();
    },
    async listStoreCategories(storeId: string): Promise<SellerCategory[]> {
      const res = await request('GET', `/v1/seller/stores/${encodeURIComponent(storeId)}/categories`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: { code: 'unknown', message: 'Failed to list categories' } }));
        throw new ApiError(res.status, payload.error?.code || 'unknown', payload.error?.message || 'Failed to list categories');
      }
      // The categories endpoint returns a bare array of categories.
      const data = await res.json();
      return Array.isArray(data) ? (data as SellerCategory[]) : [];
    },
    async updateProductMedia(storeId: string, productId: string, mediaId: string, payload: ProductMediaUpdate) {
      const res = await request(
        'PUT',
        `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/media/${encodeURIComponent(mediaId)}`,
        payload
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: { code: 'unknown', message: 'Failed to update media' } }));
        throw new ApiError(res.status, body.error?.code || 'unknown', body.error?.message || 'Failed to update media');
      }
    },
    async deleteProductMedia(storeId: string, productId: string, mediaId: string) {
      const res = await request(
        'DELETE',
        `/v1/seller/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/media/${encodeURIComponent(mediaId)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: { code: 'unknown', message: 'Failed to delete media' } }));
        throw new ApiError(res.status, body.error?.code || 'unknown', body.error?.message || 'Failed to delete media');
      }
    }
  };
}

export type SellerCategory = {
  id: string;
  slug: string;
  status: string;
};

export type ProductMediaUpdate = {
  alt_text: string;
  sort_order: number;
  is_primary: boolean;
};

export type ApiClient = ReturnType<typeof createApiClient>;


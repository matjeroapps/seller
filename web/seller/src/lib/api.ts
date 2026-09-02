export type ApiConfig = {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null>;
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
      token = await config.getAccessToken?.();
      if (token) {
        response = await execute(token ?? null);
      }
      if (response.status === 401) {
        config.onUnauthorized?.();
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
    }
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

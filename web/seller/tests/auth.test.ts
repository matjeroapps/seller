import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCodeChallenge, createCodeVerifier } from '../lib/auth/pkce';
import { createEmptySession, parseSessionCookie, serializeSessionCookie } from '../lib/auth/session-cookie';
import { getAuthorizationUrl, getZitadelConfig, getZitadelEndpoints, verifySellerApiAccess } from '../lib/auth/zitadel';

describe('seller auth foundation', () => {
  it('round trips authenticated session cookies without token material', async () => {
    const cookie = await serializeSessionCookie({
      isAuthenticated: true,
      user: {
        id: 'seller-user-1',
        email: 'seller@example.com',
        name: 'Seller User',
        roles: ['seller_owner'],
        tenantId: 'tenant-1'
      },
      expiresAt: Date.now() + 1000
    });

    expect(cookie).not.toContain('seller@example.com');
    expect((await parseSessionCookie(cookie)).user?.tenantId).toBe('tenant-1');
  });

  it('rejects missing, tampered, and expired session cookies', async () => {
    expect(await parseSessionCookie(null)).toEqual(createEmptySession());
    expect(await parseSessionCookie('not-json')).toEqual(createEmptySession());
    expect(
      await parseSessionCookie(
        await serializeSessionCookie({
          isAuthenticated: true,
          user: { id: '1', email: 'a@example.com', name: 'A', roles: [] },
          expiresAt: Date.now() - 1000
        })
      )
    ).toEqual(createEmptySession());
    expect(await parseSessionCookie(`${await serializeSessionCookie(createEmptySession())}tampered`)).toEqual(createEmptySession());
  });

  it('creates a PKCE challenge for a generated verifier', () => {
    const verifier = createCodeVerifier();
    const challenge = createCodeChallenge(verifier);

    expect(verifier.length).toBeGreaterThan(32);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('uses the configured local issuer without converting it to https', () => {
    const previousIssuer = process.env.ZITADEL_ISSUER;
    const previousProjectId = process.env.ZITADEL_PROJECT_ID;
    process.env.ZITADEL_ISSUER = 'http://localhost:8081/';
    process.env.ZITADEL_PROJECT_ID = 'seller-project-123';

    const config = getZitadelConfig();
    expect(getZitadelEndpoints(config).authorization).toBe('http://localhost:8081/oauth/v2/authorize');

    if (previousIssuer === undefined) delete process.env.ZITADEL_ISSUER;
    else process.env.ZITADEL_ISSUER = previousIssuer;
    if (previousProjectId === undefined) delete process.env.ZITADEL_PROJECT_ID;
    else process.env.ZITADEL_PROJECT_ID = previousProjectId;
  });

  it('fails closed when ZITADEL_PROJECT_ID is missing', () => {
    const previousProjectId = process.env.ZITADEL_PROJECT_ID;
    const previousNextPublicProjectId = process.env.NEXT_PUBLIC_ZITADEL_PROJECT_ID;
    delete process.env.ZITADEL_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_ZITADEL_PROJECT_ID;

    expect(() => getZitadelConfig()).toThrow(/ZITADEL_PROJECT_ID is required/i);

    if (previousProjectId !== undefined) process.env.ZITADEL_PROJECT_ID = previousProjectId;
    if (previousNextPublicProjectId !== undefined) process.env.NEXT_PUBLIC_ZITADEL_PROJECT_ID = previousNextPublicProjectId;
  });

  it('configures project audience scope and removes management scope', () => {
    const previousProjectId = process.env.ZITADEL_PROJECT_ID;
    const previousAppUrl = process.env.NEXT_PUBLIC_SELLER_APP_URL;
    process.env.ZITADEL_PROJECT_ID = 'seller-project-999';
    process.env.NEXT_PUBLIC_SELLER_APP_URL = 'http://localhost:5174';

    const config = getZitadelConfig();
    expect(config.projectId).toBe('seller-project-999');
    expect(config.scopes).toContain('urn:zitadel:iam:org:project:id:seller-project-999:aud');
    expect(config.scopes).not.toContain('urn:zitadel:iam:org:project:id:zitadel:aud');
    expect(config.postLogoutRedirectUri).toBe('http://localhost:5174');

    if (previousProjectId !== undefined) process.env.ZITADEL_PROJECT_ID = previousProjectId;
    else delete process.env.ZITADEL_PROJECT_ID;
    if (previousAppUrl !== undefined) process.env.NEXT_PUBLIC_SELLER_APP_URL = previousAppUrl;
    else delete process.env.NEXT_PUBLIC_SELLER_APP_URL;
  });

  it('adds an explicit OIDC prompt only for account recovery actions', () => {
    const config = {
      issuer: 'http://localhost:8081',
      internalIssuer: 'http://localhost:8081',
      clientId: 'seller-client',
      clientSecret: '',
      projectId: 'seller-project',
      redirectUri: 'http://localhost:5174/auth/callback',
      postLogoutRedirectUri: 'http://localhost:5174',
      scopes: ['openid']
    };
    const endpoints = getZitadelEndpoints(config);

    const signInAgain = new URL(getAuthorizationUrl(config, endpoints, 'state', 'challenge', 'login'));
    const createAccount = new URL(getAuthorizationUrl(config, endpoints, 'state', 'challenge', 'create'));
    const regularLogin = new URL(getAuthorizationUrl(config, endpoints, 'state', 'challenge'));

    expect(signInAgain.searchParams.get('prompt')).toBe('login');
    expect(createAccount.searchParams.get('prompt')).toBe('create');
    expect(regularLogin.searchParams.has('prompt')).toBe(false);
  });
});

describe('verifySellerApiAccess', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SELLER_API_BASE_URL;
  });

  it('attaches Bearer token and resolves when 2xx response contains matching principal subject', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ principal: { subject: 'user-sub-123' } })
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(verifySellerApiAccess('secret-token-123', 'user-sub-123')).resolves.toBeUndefined();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:18081/v1/bootstrap?locale=en',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          authorization: 'Bearer secret-token-123'
        })
      })
    );

  });

  it('respects SELLER_API_BASE_URL environment variable', async () => {
    const previousBaseUrl = process.env.SELLER_API_BASE_URL;
    process.env.SELLER_API_BASE_URL = 'http://seller-api.internal:8080';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ principal: { subject: 'user-sub-123' } })
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(verifySellerApiAccess('token', 'user-sub-123')).resolves.toBeUndefined();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://seller-api.internal:8080/v1/bootstrap?locale=en',
      expect.anything()
    );

    if (previousBaseUrl !== undefined) process.env.SELLER_API_BASE_URL = previousBaseUrl;
  });

  it('rejects non-2xx response without leaking token or response body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'unauthorized', sensitive_info: 'secret-key-xyz' })
    });
    vi.stubGlobal('fetch', mockFetch);

    const token = 'secret-bearer-token-999';
    await expect(verifySellerApiAccess(token, 'user-sub-123')).rejects.toThrow('Authentication bootstrap verification failed');

    try {
      await verifySellerApiAccess(token, 'user-sub-123');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
      const message = (err as Error).message;
      expect(message).not.toContain(token);
      expect(message).not.toContain('secret-key-xyz');
      expect(message).not.toContain('401');
    }
  });

  it('rejects malformed payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ bad: 'data' })
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(verifySellerApiAccess('token', 'user-sub-123')).rejects.toThrow('Authentication bootstrap verification failed');
  });

  it('rejects mismatched principal subject', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ principal: { subject: 'different-user-456' } })
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(verifySellerApiAccess('token', 'user-sub-123')).rejects.toThrow('Authentication bootstrap verification failed');
  });
});

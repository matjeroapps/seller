import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOidcAuthClient, sanitizeReturnPath, type AuthClient, type UserManagerLike } from '../src/auth/oidc';
import { createApiClient } from '../src/lib/api';
import type { User } from 'oidc-client-ts';

describe('Auth Client & API Client Integration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('fails closed in production/unconfigured mode when OIDC configuration is missing', async () => {
    // Standard unconfigured auth client without dev auth opt-in
    const auth = createOidcAuthClient();
    const state = auth.getState();

    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.error).toContain('Authentication configuration missing');

    const token = await auth.getAccessToken();
    expect(token).toBeNull();

    const renewed = await auth.renewToken();
    expect(renewed).toBeNull();
  });

  it('allows dev auth only when explicitly enabled in development', async () => {
    // Enable explicit dev auth flag
    vi.stubEnv('VITE_SELLER_DEV_AUTH', 'true');

    const auth = createOidcAuthClient();
    await auth.login('/themes');

    const state = auth.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.subject).toBe('usr_seller_dev');

    const token = await auth.getAccessToken();
    expect(token).toBe('dev-access-token');

    vi.unstubAllEnvs();
  });

  it('exercises configured OIDC path with mock UserManager adapter', async () => {
    const mockUser: User = {
      id_token: 'id-token-123',
      session_state: null,
      access_token: 'valid-access-token',
      refresh_token: 'valid-refresh-token',
      token_type: 'Bearer',
      scope: 'openid profile email',
      profile: {
        sub: 'usr_zitadel_999',
        preferred_username: 'seller_zitadel',
        email: 'seller@example.com'
      },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      state: { returnPath: '/themes' },
      expired: false,
      scopes: ['openid', 'profile', 'email'],
      toStorageString: () => '{}'
    };

    const mockUserManager: UserManagerLike = {
      getUser: vi.fn().mockResolvedValue(mockUser),
      signinRedirect: vi.fn().mockResolvedValue(undefined),
      signinRedirectCallback: vi.fn().mockResolvedValue(mockUser),
      signinSilent: vi.fn().mockResolvedValue({ ...mockUser, access_token: 'renewed-access-token' }),
      signoutRedirect: vi.fn().mockResolvedValue(undefined),
      removeUser: vi.fn().mockResolvedValue(undefined),
      events: {
        addUserLoaded: vi.fn(),
        addUserUnloaded: vi.fn(),
        addAccessTokenExpired: vi.fn()
      }
    };

    const auth = createOidcAuthClient({ userManager: mockUserManager });

    // Login invocation
    await auth.login('/themes');
    expect(mockUserManager.signinRedirect).toHaveBeenCalledWith({ state: { returnPath: '/themes' } });

    // Path-based callback invocation with returnPath restoration
    const returnPath = await auth.handleCallback('https://seller.example.com/auth/callback?code=AUTH_CODE&state=STATE_123');
    expect(mockUserManager.signinRedirectCallback).toHaveBeenCalledWith('https://seller.example.com/auth/callback?code=AUTH_CODE&state=STATE_123');
    expect(returnPath).toBe('/themes');
    expect(auth.getState().isAuthenticated).toBe(true);
    expect(auth.getUser()?.subject).toBe('usr_zitadel_999');

    // Access token retrieval
    const token = await auth.getAccessToken();
    expect(token).toBe('valid-access-token');

    // Token renewal
    const renewedToken = await auth.renewToken();
    expect(renewedToken).toBe('renewed-access-token');

    // Logout invocation
    await auth.logout();
    expect(mockUserManager.signoutRedirect).toHaveBeenCalled();
  });

  it('rejects external return URLs during callback handling', () => {
    expect(sanitizeReturnPath('https://evil-attacker.com/phish')).toBe('/');
    expect(sanitizeReturnPath('//evil-attacker.com')).toBe('/');
    expect(sanitizeReturnPath('/\\evil-attacker.com')).toBe('/');
    expect(sanitizeReturnPath('/themes')).toBe('/themes');
    expect(sanitizeReturnPath(undefined)).toBe('/');
  });

  it('handles callback errors gracefully', async () => {
    const mockUserManager: UserManagerLike = {
      getUser: vi.fn().mockResolvedValue(null),
      signinRedirect: vi.fn().mockResolvedValue(undefined),
      signinRedirectCallback: vi.fn().mockRejectedValue(new Error('Invalid authorization code')),
      signinSilent: vi.fn().mockResolvedValue(null),
      signoutRedirect: vi.fn().mockResolvedValue(undefined),
      removeUser: vi.fn().mockResolvedValue(undefined),
      events: {
        addUserLoaded: vi.fn(),
        addUserUnloaded: vi.fn(),
        addAccessTokenExpired: vi.fn()
      }
    };

    const auth = createOidcAuthClient({ userManager: mockUserManager });

    await expect(auth.handleCallback('https://seller.example.com/auth/callback?error=invalid_grant')).rejects.toThrow('Invalid authorization code');
  });

  it('attaches Bearer token to API client requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const auth: AuthClient = {
      getAccessToken: async () => 'test-bearer-token-123',
      renewToken: async () => 'test-bearer-token-123',
      clearSession: async () => {},
      login: async () => {},
      handleCallback: async () => '/',
      logout: async () => {},
      getUser: () => ({ subject: 'test-sub' }),
      subscribe: () => () => {},
      getState: () => ({ isAuthenticated: true, user: { subject: 'test-sub' }, isLoading: false, error: null })
    };

    const api = createApiClient({
      baseUrl: 'https://seller.example.com',
      getAccessToken: () => auth.getAccessToken()
    });

    await api.get('/v1/seller/themes');

    expect(fetchSpy).toHaveBeenCalledWith(
      new URL('/v1/seller/themes', 'https://seller.example.com'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-bearer-token-123'
        })
      })
    );
  });

  it('handles 401 unauthorized: renews token once, retries once, clears session if still 401', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'token_expired' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'token_invalid' }), { status: 401 }));

    const renewToken = vi.fn().mockResolvedValue('renewed-token-B');
    const onUnauthorized = vi.fn();

    const api = createApiClient({
      baseUrl: 'https://seller.example.com',
      getAccessToken: async () => 'expired-token-A',
      renewToken,
      onUnauthorized
    });

    const res = await api.get('/v1/seller/stores');
    expect(res.status).toBe(401);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(renewToken).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('handles 401 initial request followed by 403 retry without clearing authentication', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'token_expired' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }));

    const renewToken = vi.fn().mockResolvedValue('renewed-token-B');
    const onUnauthorized = vi.fn();
    const onForbidden = vi.fn();

    const api = createApiClient({
      baseUrl: 'https://seller.example.com',
      getAccessToken: async () => 'expired-token-A',
      renewToken,
      onUnauthorized,
      onForbidden
    });

    const res = await api.get('/v1/seller/stores/store_123/theme');
    expect(res.status).toBe(403);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(renewToken).toHaveBeenCalledTimes(1);
    expect(onForbidden).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});


import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOidcAuthClient, type AuthClient } from '../src/auth/oidc';
import { createApiClient } from '../src/lib/api';

describe('Auth Client & API Client Integration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('starts as unauthenticated when no session exists', async () => {
    const auth = createOidcAuthClient();
    const state = auth.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    const token = await auth.getAccessToken();
    expect(token).toBeNull();
  });

  it('supports login and session restore in dev mode', async () => {
    const auth = createOidcAuthClient();
    await auth.login('/themes');

    const state = auth.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.subject).toBe('usr_seller_dev');

    const token = await auth.getAccessToken();
    expect(token).toBe('dev-access-token');
  });

  it('clears state on logout', async () => {
    const auth = createOidcAuthClient();
    await auth.login('/themes');
    expect(auth.getState().isAuthenticated).toBe(true);

    await auth.logout();
    expect(auth.getState().isAuthenticated).toBe(false);
    expect(await auth.getAccessToken()).toBeNull();
  });

  it('attaches Bearer token to API client requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const auth: AuthClient = {
      getAccessToken: async () => 'test-bearer-token-123',
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

  it('handles 401 unauthorized and invokes callback', async () => {
    const onUnauthorized = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'Token invalid' } }), { status: 401 })
    );

    const api = createApiClient({
      baseUrl: 'https://seller.example.com',
      getAccessToken: async () => 'expired-token',
      onUnauthorized
    });

    const res = await api.get('/v1/seller/stores');
    expect(res.status).toBe(401);
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it('handles 403 forbidden without infinite retry loop', async () => {
    const onForbidden = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'forbidden', message: 'Not store owner' } }), { status: 403 })
    );

    const api = createApiClient({
      baseUrl: 'https://seller.example.com',
      getAccessToken: async () => 'valid-token',
      onForbidden
    });

    const res = await api.get('/v1/seller/stores/other-store/theme');
    expect(res.status).toBe(403);
    expect(onForbidden).toHaveBeenCalledTimes(1);
  });

  it('prevents open redirects during callback handling', async () => {
    const auth = createOidcAuthClient();
    // Path sanitization test
    await auth.login('https://evil-attacker.com/phish');
    expect(window.location.hash).toBe('#/');
  });
});

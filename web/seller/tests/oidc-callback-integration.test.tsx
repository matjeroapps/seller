import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Router } from '../src/routes/Router';
import { createOidcAuthClient, type UserManagerLike } from '../src/auth/oidc';
import { createApiClient } from '../src/lib/api';
import type { User } from 'oidc-client-ts';

describe('Realistic Auth Callback Integration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('handles path-based /auth/callback?code=CODE&state=STATE without hash and restores saved return path', async () => {
    // 1. Set window location to path-based callback URL (NOT hash-based!)
    delete (window as any).location;
    window.location = new URL('https://seller.example.com/auth/callback?code=VALID_CODE&state=VALID_STATE') as any;

    const mockUser: User = {
      id_token: 'id-123',
      session_state: null,
      access_token: 'access-token-abc',
      refresh_token: 'refresh-token-abc',
      token_type: 'Bearer',
      scope: 'openid profile email',
      profile: { sub: 'usr_seller_1' },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      state: { returnPath: '/themes' },
      expired: false,
      scopes: ['openid'],
      toStorageString: () => '{}'
    };

    const mockUserManager: UserManagerLike = {
      getUser: vi.fn().mockResolvedValue(null),
      signinRedirect: vi.fn().mockResolvedValue(undefined),
      signinRedirectCallback: vi.fn().mockResolvedValue(mockUser),
      signinSilent: vi.fn().mockResolvedValue(mockUser),
      signoutRedirect: vi.fn().mockResolvedValue(undefined),
      removeUser: vi.fn().mockResolvedValue(undefined),
      events: {
        addUserLoaded: vi.fn(),
        addUserUnloaded: vi.fn(),
        addAccessTokenExpired: vi.fn()
      }
    };

    const authClient = createOidcAuthClient({ userManager: mockUserManager });
    const api = createApiClient({ baseUrl: 'https://seller.example.com', getAccessToken: () => authClient.getAccessToken() });

    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    render(
      <Router
        authClient={authClient}
        api={api}
        locale="en"
        copy={{ authenticating: 'Completing authentication...', themeCatalog: 'Theme Catalog' }}
        renderDashboard={() => <div>Dashboard Content</div>}
        stores={[{ id: 'str_1', name: 'Store One', code: 's1', market_code: 'EG' }]}
      />
    );

    // Initial render shows callback processing indicator
    expect(screen.getByText('Completing authentication...')).toBeInTheDocument();

    // Verify handleCallback executes signinRedirectCallback on userManager with full URL
    await waitFor(() => {
      expect(mockUserManager.signinRedirectCallback).toHaveBeenCalledWith('https://seller.example.com/auth/callback?code=VALID_CODE&state=VALID_STATE');
    });

    // Verify history.replaceState strips callback query params and updates to saved return path
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/#/themes');
    });
  });
});

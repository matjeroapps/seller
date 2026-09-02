import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Router } from '../src/routes/Router';
import { createApiClient } from '../src/lib/api';
import type { AuthClient } from '../src/auth/oidc';

describe('Cross-Store & Principal State Isolation', () => {
  it('resets store-specific theme state when switching selected store', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes('/stores/str_A/theme')) {
        return new Response(
          JSON.stringify({
            installation: { id: 'ins_A', store_id: 'str_A', theme_id: 'thm_1', theme_version_id: 'ver_1', status: 'active' },
            draft_config: { title: 'Store A Draft' },
            published_config: { title: 'Store A Published' },
            draft_revision: 10,
            published_revision: 5
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('/stores/str_B/theme')) {
        return new Response(
          JSON.stringify({
            installation: { id: 'ins_B', store_id: 'str_B', theme_id: 'thm_2', theme_version_id: 'ver_2', status: 'active' },
            draft_config: { title: 'Store B Draft' },
            published_config: { title: 'Store B Published' },
            draft_revision: 1,
            published_revision: 1
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('/versions')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      return new Response('Not found', { status: 404 });
    });

    const mockAuth: AuthClient = {
      getAccessToken: async () => 'test-token',
      login: async () => {},
      handleCallback: async () => '/',
      logout: async () => {},
      getUser: () => ({ subject: 'usr_seller_1' }),
      subscribe: () => () => {},
      getState: () => ({ isAuthenticated: true, user: { subject: 'usr_seller_1' }, isLoading: false, error: null })
    };

    const api = createApiClient({ baseUrl: 'https://seller.example.com', getAccessToken: mockAuth.getAccessToken });
    const stores = [
      { id: 'str_A', name: 'Store Alpha', code: 'alpha', market_code: 'EG' },
      { id: 'str_B', name: 'Store Beta', code: 'beta', market_code: 'SA' }
    ];

    window.location.hash = '#/stores/str_A/theme';

    render(
      <Router
        authClient={mockAuth}
        api={api}
        locale="en"
        copy={{
          dashboard: 'Dashboard',
          themeCatalog: 'Theme Catalog',
          storeThemeManagement: 'Store Theme',
          activeStore: 'Active Store',
          currentStoreTheme: 'Current Store Theme',
          draftRev: 'Draft Rev',
          publishedRev: 'Published Rev',
          version: 'Version'
        }}
        renderDashboard={() => <div>Dashboard Content</div>}
        stores={stores}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Draft Rev: #10/)).toBeInTheDocument();
    });

    // Switch store selector to Store Beta
    const storeSelect = screen.getByLabelText('Active Store:');
    fireEvent.change(storeSelect, { target: { value: 'str_B' } });

    await waitFor(() => {
      expect(screen.getByText(/Draft Rev: #1/)).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ href: expect.stringContaining('/stores/str_B/theme') }),
      expect.anything()
    );
  });
});

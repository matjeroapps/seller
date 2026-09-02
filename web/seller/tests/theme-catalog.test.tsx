import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeCatalog } from '../src/components/ThemeCatalog';
import { createApiClient } from '../src/lib/api';

describe('ThemeCatalog Component', () => {
  const messages = {
    platformThemes: 'Platform Themes',
    availableVersions: 'Available Versions',
    install: 'Install Theme',
    active: 'Active',
    version: 'Version',
    actions: 'Action',
    loadingThemes: 'Loading theme catalog...',
    loadingVersions: 'Loading versions...',
    installThemeTitle: 'Confirm Theme Installation',
    installConfirmMessage: 'Are you sure you want to install',
    confirmInstall: 'Install',
    cancel: 'Cancel'
  };

  it('renders themes and lists version when a theme is selected', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes('/versions')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'ver_1',
                theme_id: 'thm_1',
                version: '1.0.0',
                status: 'published',
                configuration_schema: {},
                default_configuration: {},
                component_registry_version: '1.0.0',
                created_at: '2026-01-01T00:00:00Z'
              }
            ]
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('/v1/seller/themes')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'thm_1',
                key: 'matjero-default',
                name: 'Matjero Default',
                description: 'Default platform theme',
                type: 'free',
                status: 'active',
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z'
              }
            ]
          }),
          { status: 200 }
        );
      }
      return new Response('Not found', { status: 404 });
    });

    const api = createApiClient({ baseUrl: 'https://seller.example.com' });

    render(
      <ThemeCatalog
        api={api}
        selectedStoreId="str_123"
        currentInstalledThemeKey="matjero-default"
        onThemeInstalled={vi.fn()}
        locale="en"
        copy={messages}
      />
    );

    expect(screen.getByText('Loading theme catalog...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('Matjero Default').length).toBeGreaterThan(0);
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    });

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('triggers install confirmation modal on click', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes('/versions')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'ver_1',
                theme_id: 'thm_1',
                version: '1.0.0',
                status: 'published',
                configuration_schema: {},
                default_configuration: {},
                component_registry_version: '1.0.0',
                created_at: '2026-01-01T00:00:00Z'
              }
            ]
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('/v1/seller/themes')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'thm_1',
                key: 'matjero-default',
                name: 'Matjero Default',
                description: 'Default platform theme',
                type: 'free',
                status: 'active',
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z'
              }
            ]
          }),
          { status: 200 }
        );
      }
      return new Response('Not found', { status: 404 });
    });

    const api = createApiClient({ baseUrl: 'https://seller.example.com' });

    render(
      <ThemeCatalog
        api={api}
        selectedStoreId="str_123"
        currentInstalledThemeKey=""
        onThemeInstalled={vi.fn()}
        locale="en"
        copy={messages}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('Matjero Default').length).toBeGreaterThan(0);
      expect(screen.getByText('Install Theme')).toBeInTheDocument();
    });

    const installBtn = screen.getByText('Install Theme');
    fireEvent.click(installBtn);

    expect(screen.getByText('Confirm Theme Installation')).toBeInTheDocument();
  });
});

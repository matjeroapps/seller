import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ThemeEditorPanel } from '../src/components/ThemeEditorPanel';
import { createApiClient } from '../src/lib/api';

describe('ThemeEditorPanel Workflow', () => {
  const copy = {
    currentStoreTheme: 'Current Store Theme',
    saveDraft: 'Save Draft',
    previewDraft: 'Preview Draft',
    discardDraft: 'Discard Changes',
    publishTheme: 'Publish Theme',
    draftRev: 'Draft Rev',
    publishedRev: 'Published Rev',
    version: 'Version',
    publishModalTitle: 'Publish Draft Theme',
    publishModalMessage: 'Are you sure you want to publish',
    publish: 'Publish Live',
    discardModalTitle: 'Discard Draft Changes',
    discardModalMessage: 'Are you sure you want to discard',
    discard: 'Discard Changes',
    cancel: 'Cancel',
    upgradeAvailable: 'Theme Upgrade Available',
    selectVersion: 'Select version',
    upgrade: 'Upgrade Version',
    upgradeModalTitle: 'Upgrade Theme Version',
    upgradeModalMessage: 'Are you sure you want to upgrade'
  };

  const setupMockApi = () => {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = url.toString();
      const method = init?.method || 'GET';

      if (urlStr.includes('/theme/draft') && method === 'PUT') {
        const body = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({ config: body.config, revision: 2 }),
          { status: 200 }
        );
      }

      if (urlStr.includes('/theme/publish') && method === 'POST') {
        return new Response(JSON.stringify({ published_revision: 2 }), { status: 200 });
      }

      if (urlStr.includes('/theme/discard') && method === 'POST') {
        return new Response(JSON.stringify({ config: { logo: 'https://example.com/reverted.png' }, revision: 1 }), { status: 200 });
      }

      if (urlStr.includes('/v1/seller/themes?') || urlStr.endsWith('/v1/seller/themes')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'thm_1',
                key: 'thm_1',
                name: 'Theme 1',
                description: 'Test theme',
                type: 'official',
                status: 'published'
              }
            ]
          }),
          { status: 200 }
        );
      }

      if (urlStr.includes('/themes/thm_1/versions')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'ver_1',
                theme_id: 'thm_1',
                version: '1.0.0',
                status: 'published',
                configuration_schema: {
                  type: 'object',
                  properties: {
                    logo: { type: 'string', title: 'Logo' }
                  }
                },
                default_configuration: { logo: '' },
                component_registry_version: '1.0.0',
                created_at: '2026-01-01T00:00:00Z'
              },
              {
                id: 'ver_2',
                theme_id: 'thm_1',
                version: '1.1.0',
                status: 'published',
                configuration_schema: {},
                default_configuration: {},
                component_registry_version: '1.1.0',
                created_at: '2026-02-01T00:00:00Z'
              }
            ]
          }),
          { status: 200 }
        );
      }

      if (urlStr.includes('/v1/seller/stores/str_1/theme')) {
        return new Response(
          JSON.stringify({
            installation: {
              id: 'ins_1',
              store_id: 'str_1',
              theme_id: 'thm_1',
              theme_version_id: 'ver_1',
              status: 'active',
              installed_at: '2026-01-01T00:00:00Z',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z'
            },
            draft_config: { logo: 'https://example.com/logo.png' },
            published_config: { logo: 'https://example.com/logo.png' },
            draft_revision: 1,
            published_revision: 1
          }),
          { status: 200 }
        );
      }

      return new Response('Not found', { status: 404 });
    });
  };

  it('loads theme installation details and renders draft editor', async () => {
    setupMockApi();
    const api = createApiClient({ baseUrl: 'https://seller.example.com' });

    render(
      <ThemeEditorPanel
        api={api}
        storeId="str_1"
        locale="en"
        copy={copy}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Current Store Theme')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Logo')).toHaveValue('https://example.com/logo.png');
    expect(screen.getByText('Theme Upgrade Available')).toBeInTheDocument();
  });

  it('executes draft save, publish, and discard with confirmation modal', async () => {
    const fetchSpy = setupMockApi();
    const api = createApiClient({ baseUrl: 'https://seller.example.com' });

    render(
      <ThemeEditorPanel
        api={api}
        storeId="str_1"
        locale="en"
        copy={copy}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Logo')).toBeInTheDocument();
    });

    // 1. Edit field & save draft
    fireEvent.change(screen.getByLabelText('Logo'), { target: { value: 'https://example.com/new.png' } });
    const saveBtn = screen.getByText('Save Draft');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ href: expect.stringContaining('/theme/draft') }),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    // 2. Publish with confirmation
    const publishBtn = screen.getByText('Publish Theme');
    fireEvent.click(publishBtn);

    expect(screen.getByText('Publish Draft Theme')).toBeInTheDocument();
    const modalPublishBtn = within(screen.getByRole('dialog')).getByText('Publish Live');
    fireEvent.click(modalPublishBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ href: expect.stringContaining('/theme/publish') }),
        expect.objectContaining({ method: 'POST' })
      );
    });

    // 3. Discard with confirmation
    const discardBtn = screen.getByText('Discard Changes');
    fireEvent.click(discardBtn);

    expect(screen.getByText('Discard Draft Changes')).toBeInTheDocument();
    const modalDiscardBtn = within(screen.getByRole('dialog')).getByText('Discard Changes');
    fireEvent.click(modalDiscardBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ href: expect.stringContaining('/theme/discard') }),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('resolves installation theme_id to theme key before fetching versions (ID vs Key regression)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();

      if (urlStr.includes('/v1/seller/stores/str_123/theme')) {
        return new Response(
          JSON.stringify({
            installation: {
              id: 'ins_123',
              store_id: 'str_123',
              theme_id: 'thm_123',
              theme_version_id: 'ver_123',
              status: 'active'
            },
            draft_config: { hero_title: 'Welcome' },
            published_config: { hero_title: 'Welcome' },
            draft_revision: 1,
            published_revision: 1
          }),
          { status: 200 }
        );
      }

      if (urlStr.includes('/v1/seller/themes?')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'thm_123',
                key: 'matjero-default',
                name: 'Matjero Default Theme',
                description: 'Default storefront theme',
                type: 'official',
                status: 'published'
              }
            ]
          }),
          { status: 200 }
        );
      }

      if (urlStr.includes('/v1/seller/themes/matjero-default/versions')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'ver_123',
                theme_id: 'thm_123',
                version: '1.0.0',
                status: 'published',
                configuration_schema: {
                  type: 'object',
                  properties: {
                    hero_title: { type: 'string', title: 'Hero Title' }
                  }
                },
                default_configuration: { hero_title: '' },
                component_registry_version: '1.0.0'
              }
            ]
          }),
          { status: 200 }
        );
      }

      // Strict Core contract check: if queried by database ID instead of key, return 404!
      if (urlStr.includes('/v1/seller/themes/thm_123/versions')) {
        return new Response(JSON.stringify({ error: { code: 'not_found', message: 'Theme not found by key: thm_123' } }), { status: 404 });
      }

      return new Response('Not found', { status: 404 });
    });

    const api = createApiClient({ baseUrl: 'https://seller.example.com' });

    render(
      <ThemeEditorPanel
        api={api}
        storeId="str_123"
        locale="en"
        copy={copy}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Hero Title')).toHaveValue('Welcome');
    });

    // Prove UI called /matjero-default/versions and did NOT call /thm_123/versions
    const calledUrls = fetchSpy.mock.calls.map((call) => call[0].toString());
    expect(calledUrls.some((u) => u.includes('/v1/seller/themes/matjero-default/versions'))).toBe(true);
    expect(calledUrls.some((u) => u.includes('/v1/seller/themes/thm_123/versions'))).toBe(false);
  });
});


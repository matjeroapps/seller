import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sellerApi } from '../lib/api/client';

describe('Theme API Client Contracts (T004)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('listThemes fetches available platform themes', async () => {
    const mockResponse = {
      items: [
        { key: 'default', name: 'Default', type: 'free', status: 'active' },
        { key: 'boutique', name: 'Boutique', type: 'free', status: 'active' }
      ]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const res = await sellerApi.listThemes();
    expect(res.items).toHaveLength(2);
    expect(res.items[0].key).toBe('default');
    expect(res.items[1].key).toBe('boutique');
  });

  it('getThemeInstallation fetches active installation and configuration', async () => {
    const mockResponse = {
      installation: {
        id: 'inst-1',
        store_id: 'store-1',
        theme_key: 'default',
        version: '1.0.0',
        status: 'active'
      },
      draft_config: { primary_color: '#4f46e5' },
      published_config: { primary_color: '#4f46e5' },
      draft_revision: 1,
      published_revision: 1
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const res = await sellerApi.getThemeInstallation('store-1');
    expect(res.installation.theme_key).toBe('default');
    expect(res.draft_revision).toBe(1);
    expect(res.draft_config?.primary_color).toBe('#4f46e5');
  });

  it('installTheme triggers installation and returns new installation object', async () => {
    const mockResponse = {
      installation: {
        id: 'inst-2',
        store_id: 'store-1',
        theme_key: 'boutique',
        version: '1.0.0',
        status: 'active'
      }
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => mockResponse
    });

    const res = await sellerApi.installTheme('store-1', { theme_key: 'boutique', version: '1.0.0' });
    expect(res.installation.theme_key).toBe('boutique');
    expect(res.installation.status).toBe('active');
  });

  it('createThemePreview creates a signed preview token', async () => {
    const mockResponse = { token: 'mock-signed-jwt-preview-token' };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const res = await sellerApi.createThemePreview('store-1');
    expect(res.token).toBe('mock-signed-jwt-preview-token');
  });

  it('updateThemeDraft updates draft configuration and increments revision', async () => {
    const mockResponse = {
      config: { primary_color: '#0ea5e9' },
      revision: 2
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const res = await sellerApi.updateThemeDraft('store-1', { primary_color: '#0ea5e9' });
    expect(res.config.primary_color).toBe('#0ea5e9');
    expect(res.revision).toBe(2);
  });

  it('publishTheme publishes draft configuration', async () => {
    const mockResponse = { published_revision: 2 };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const res = await sellerApi.publishTheme('store-1');
    expect(res.published_revision).toBe(2);
  });

  it('discardThemeDraft resets draft configuration to published baseline', async () => {
    const mockResponse = {
      config: { primary_color: '#4f46e5' },
      revision: 1
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const res = await sellerApi.discardThemeDraft('store-1');
    expect(res.config.primary_color).toBe('#4f46e5');
    expect(res.revision).toBe(1);
  });
});

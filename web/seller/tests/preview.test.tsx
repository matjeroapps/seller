import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { buildPreviewUrl, validateBareHost, validateStorefrontProtocol } from '../src/lib/preview';
import { ThemeEditorPanel } from '../src/components/ThemeEditorPanel';
import { createApiClient } from '../src/lib/api';

describe('Preview Pipeline & Security', () => {
  it('validates protocol correctly', () => {
    expect(validateStorefrontProtocol('https')).toBe('https');
    expect(validateStorefrontProtocol('http')).toBe('http');
    expect(validateStorefrontProtocol('HTTPS:')).toBe('https');
    expect(() => validateStorefrontProtocol('javascript')).toThrow(/Invalid storefront protocol/);
    expect(() => validateStorefrontProtocol('ftp')).toThrow(/Invalid storefront protocol/);
  });

  it('validates bare host without path or injection', () => {
    expect(validateBareHost('shop.example.com')).toBe('shop.example.com');
    expect(validateBareHost('localhost:3000')).toBe('localhost:3000');
    expect(() => validateBareHost('shop.example.com/path')).toThrow(/Invalid bare host/);
    expect(() => validateBareHost('user:pass@shop.com')).toThrow(/Invalid bare host/);
    expect(() => validateBareHost('javascript:alert(1)')).toThrow();
  });

  it('constructs safe preview URL with encoded token and locale', () => {
    const url = buildPreviewUrl({
      host: 'storefront.matjero.internal',
      protocol: 'https',
      locale: 'ar',
      token: 'preview_tok_abc123'
    });

    expect(url).toBe('https://storefront.matjero.internal/ar?theme_preview=preview_tok_abc123');
  });

  it('executes preview flow by fetching host, generating token, and opening tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = url.toString();

      if (urlStr.includes('/storefront-host')) {
        return new Response(JSON.stringify({ host: 'shop.example.com' }), { status: 200 });
      }

      if (urlStr.includes('/theme/preview')) {
        return new Response(JSON.stringify({ token: 'preview_secret_token_123' }), { status: 200 });
      }

      if (urlStr.includes('/themes/thm_1/versions')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }

      if (urlStr.includes('/v1/seller/stores/str_1/theme')) {
        return new Response(
          JSON.stringify({
            installation: {
              id: 'ins_1',
              store_id: 'str_1',
              theme_id: 'thm_1',
              theme_version_id: 'ver_1',
              status: 'active'
            },
            draft_config: { logo: '' },
            published_config: { logo: '' },
            draft_revision: 1,
            published_revision: 1
          }),
          { status: 200 }
        );
      }

      return new Response('Not found', { status: 404 });
    });

    const api = createApiClient({ baseUrl: 'https://seller.example.com' });

    render(
      <ThemeEditorPanel
        api={api}
        storeId="str_1"
        locale="en"
        copy={{
          currentStoreTheme: 'Current Store Theme',
          previewDraft: 'Preview Draft',
          draftRev: 'Draft Rev',
          publishedRev: 'Published Rev',
          version: 'Version'
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Current Store Theme')).toBeInTheDocument();
    });

    const previewBtn = screen.getByText('Preview Draft');
    fireEvent.click(previewBtn);

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        'https://shop.example.com/en?theme_preview=preview_secret_token_123',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });
});

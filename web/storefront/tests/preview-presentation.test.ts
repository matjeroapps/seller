import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { StoreBootstrap } from '../src/lib/contracts';
import { HOST_A, storeA, categoriesA } from './fixtures/storefront';
import { PREVIEW_INVALID_HEADER, PREVIEW_TOKEN_HEADER } from '../src/lib/headers';

let server: Server;
let currentHostHeader = HOST_A;
let currentHeadersMap: Record<string, string> = {};
let requestLog: { host: string | undefined; url: string; previewHeader: string | undefined }[] = [];

const publishedStore: StoreBootstrap = {
  ...storeA,
  theme: {
    key: 'matjero-default',
    version: '1.0.0',
    configuration_revision: 1,
    configuration: {
      hero: {
        title: 'Published Theme'
      }
    }
  }
};

const draftStore: StoreBootstrap = {
  ...storeA,
  theme: {
    key: 'matjero-default',
    version: '1.0.0',
    configuration_revision: 2,
    configuration: {
      hero: {
        title: 'Draft Theme'
      }
    }
  }
};

vi.mock('next/headers', () => ({
  headers: async () => {
    const h = new Headers({ host: currentHostHeader });
    for (const [key, value] of Object.entries(currentHeadersMap)) {
      h.set(key, value);
    }
    return h;
  }
}));

const redirectMock = vi.fn();
const notFoundMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectMock(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  notFound: () => {
    notFoundMock();
    throw new Error('NEXT_NOT_FOUND');
  }
}));

async function loadPresentationModule() {
  vi.resetModules();
  return import('../src/server/presentation');
}

async function loadRootPageModule() {
  vi.resetModules();
  return import('../src/app/page');
}

beforeAll(async () => {
  server = createServer((request, response) => {
    const host = request.headers.host?.split(':')[0];
    const previewHeader = request.headers['x-matjero-storefront-preview'] as string | undefined;
    requestLog.push({ host, url: request.url ?? '', previewHeader });

    response.writeHead(200, { 'content-type': 'application/json' });
    if ((request.url ?? '').startsWith('/v1/storefront/categories')) {
      response.end(JSON.stringify({ items: categoriesA }));
      return;
    }

    if (previewHeader && previewHeader.length > 0) {
      response.end(JSON.stringify({ store: draftStore }));
    } else {
      response.end(JSON.stringify({ store: publishedStore }));
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  vi.stubEnv('STOREFRONT_API_BASE_URL', `http://127.0.0.1:${address.port}`);
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  requestLog = [];
  currentHostHeader = HOST_A;
  currentHeadersMap = {};
  redirectMock.mockReset();
  notFoundMock.mockReset();
});

afterEach(() => {
  vi.resetModules();
});

describe('Preview Presentation Integration', () => {
  it('loads Draft Theme when valid PREVIEW_TOKEN_HEADER is set', async () => {
    currentHeadersMap[PREVIEW_TOKEN_HEADER] = 'token-123';
    const { loadPresentation } = await loadPresentationModule();

    const presentation = await loadPresentation('ar');

    expect(presentation.settings.hero?.title).toBe('Draft Theme');
    expect(presentation.settings.hero?.title).not.toBe('Published Theme');

    expect(requestLog.some((req) => req.previewHeader === 'token-123')).toBe(true);

    const { links, localeLinks, navigationCategories } = presentation.context;
    expect(links.home).toBe('/ar?theme_preview=token-123');
    expect(links.products).toBe('/ar/products?theme_preview=token-123');
    expect(links.categories).toBe('/ar/categories?theme_preview=token-123');
    expect(links.search).toBe('/ar/search?theme_preview=token-123');

    for (const link of localeLinks) {
      expect(link.href).toContain('theme_preview=token-123');
    }
    for (const cat of navigationCategories) {
      expect(cat.href).toContain('theme_preview=token-123');
    }
  });

  it('loads Published Theme when no preview header is present', async () => {
    const { loadPresentation } = await loadPresentationModule();

    const presentation = await loadPresentation('ar');

    expect(presentation.settings.hero?.title).toBe('Published Theme');
    expect(linksHasNoPreviewToken(presentation.context.links)).toBe(true);
  });

  it('fails closed when PREVIEW_INVALID_HEADER is present', async () => {
    currentHeadersMap[PREVIEW_INVALID_HEADER] = 'duplicate_token_param';
    const { loadPresentation, isStoreUnavailable } = await loadPresentationModule();

    const error = await loadPresentation('ar').catch((thrown: unknown) => thrown);
    expect(isStoreUnavailable(error)).toBe(true);
  });
});

describe('Root Page Preview Redirect', () => {
  it('redirects /?theme_preview=T to /{defaultLocale}?theme_preview=T and probes Store with preview token', async () => {
    currentHeadersMap[PREVIEW_TOKEN_HEADER] = 'token-root-xyz';
    const RootPage = (await loadRootPageModule()).default;

    await expect(RootPage()).rejects.toThrow('NEXT_REDIRECT:/ar?theme_preview=token-root-xyz');
    expect(redirectMock).toHaveBeenCalledWith('/ar?theme_preview=token-root-xyz');

    expect(requestLog.some((req) => req.previewHeader === 'token-root-xyz')).toBe(true);
  });

  it('redirects / normally to /{defaultLocale} without theme_preview when no preview is requested', async () => {
    const RootPage = (await loadRootPageModule()).default;

    await expect(RootPage()).rejects.toThrow('NEXT_REDIRECT:/ar');
    expect(redirectMock).toHaveBeenCalledWith('/ar');
  });

  it('fails closed with notFound() when invalid preview token header is set on bare root', async () => {
    currentHeadersMap[PREVIEW_INVALID_HEADER] = 'invalid_token_size';
    const RootPage = (await loadRootPageModule()).default;

    await expect(RootPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalled();
  });
});

function linksHasNoPreviewToken(links: Record<string, string>): boolean {
  return Object.values(links).every((link) => !link.includes('theme_preview'));
}

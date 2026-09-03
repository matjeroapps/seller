import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

describe('HTTP Static Server & SPA Callback Routing Smoke', () => {
  let server: http.Server;
  let serverUrl: string;

  beforeAll(async () => {
    // Ensure dist directory exists with index.html for testing
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    const indexPath = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, '<!DOCTYPE html><html><body><div id="root">Seller Dashboard</div></body></html>');
    }
    const assetsDir = path.join(distDir, 'assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    fs.writeFileSync(path.join(assetsDir, 'test-bundle.js'), 'console.log("seller bundle");');

    server = createStaticServer(distDir);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as { port: number };
    serverUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('serves SPA HTML on GET /auth/callback?code=TEST_CODE&state=TEST_STATE', async () => {
    const res = await fetch(`${serverUrl}/auth/callback?code=TEST_CODE&state=TEST_STATE`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const text = await res.text();
    expect(text).toContain('<div id="root">');
  });

  it('serves SPA HTML on GET /', async () => {
    const res = await fetch(`${serverUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const text = await res.text();
    expect(text).toContain('<div id="root">');
  });

  it('serves actual static asset file on GET /assets/test-bundle.js', async () => {
    const res = await fetch(`${serverUrl}/assets/test-bundle.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/javascript');
    const text = await res.text();
    expect(text).toBe('console.log("seller bundle");');
  });

  it('does NOT swallow API routes with SPA fallback on GET /v1/seller/themes', async () => {
    const res = await fetch(`${serverUrl}/v1/seller/themes`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body.error?.code).toBe('not_found');
  });
});

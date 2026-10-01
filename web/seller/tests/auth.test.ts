import { describe, expect, it } from 'vitest';

import { createCodeChallenge, createCodeVerifier } from '../lib/auth/pkce';
import { createEmptySession, parseSessionCookie, serializeSessionCookie } from '../lib/auth/session-cookie';
import { getZitadelConfig, getZitadelEndpoints } from '../lib/auth/zitadel';

describe('seller auth foundation', () => {
  it('round trips authenticated session cookies without token material', async () => {
    const cookie = await serializeSessionCookie({
      isAuthenticated: true,
      user: {
        id: 'seller-user-1',
        email: 'seller@example.com',
        name: 'Seller User',
        roles: ['seller_owner'],
        tenantId: 'tenant-1'
      },
      expiresAt: Date.now() + 1000
    });

    expect(cookie).not.toContain('seller@example.com');
    expect((await parseSessionCookie(cookie)).user?.tenantId).toBe('tenant-1');
  });

  it('rejects missing, tampered, and expired session cookies', async () => {
    expect(await parseSessionCookie(null)).toEqual(createEmptySession());
    expect(await parseSessionCookie('not-json')).toEqual(createEmptySession());
    expect(
      await parseSessionCookie(
        await serializeSessionCookie({
          isAuthenticated: true,
          user: { id: '1', email: 'a@example.com', name: 'A', roles: [] },
          expiresAt: Date.now() - 1000
        })
      )
    ).toEqual(createEmptySession());
    expect(await parseSessionCookie(`${await serializeSessionCookie(createEmptySession())}tampered`)).toEqual(createEmptySession());
  });

  it('creates a PKCE challenge for a generated verifier', () => {
    const verifier = createCodeVerifier();
    const challenge = createCodeChallenge(verifier);

    expect(verifier.length).toBeGreaterThan(32);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('uses the configured local issuer without converting it to https', () => {
    const previousIssuer = process.env.ZITADEL_ISSUER;
    const previousProjectId = process.env.ZITADEL_PROJECT_ID;
    process.env.ZITADEL_ISSUER = 'http://localhost:8081/';
    process.env.ZITADEL_PROJECT_ID = 'seller-project-123';

    const config = getZitadelConfig();
    expect(getZitadelEndpoints(config).authorization).toBe('http://localhost:8081/oauth/v2/authorize');

    if (previousIssuer === undefined) delete process.env.ZITADEL_ISSUER;
    else process.env.ZITADEL_ISSUER = previousIssuer;
    if (previousProjectId === undefined) delete process.env.ZITADEL_PROJECT_ID;
    else process.env.ZITADEL_PROJECT_ID = previousProjectId;
  });

  it('fails closed when ZITADEL_PROJECT_ID is missing', () => {
    const previousProjectId = process.env.ZITADEL_PROJECT_ID;
    const previousNextPublicProjectId = process.env.NEXT_PUBLIC_ZITADEL_PROJECT_ID;
    delete process.env.ZITADEL_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_ZITADEL_PROJECT_ID;

    expect(() => getZitadelConfig()).toThrow(/ZITADEL_PROJECT_ID is required/i);

    if (previousProjectId !== undefined) process.env.ZITADEL_PROJECT_ID = previousProjectId;
    if (previousNextPublicProjectId !== undefined) process.env.NEXT_PUBLIC_ZITADEL_PROJECT_ID = previousNextPublicProjectId;
  });

  it('configures project audience scope and removes management scope', () => {
    const previousProjectId = process.env.ZITADEL_PROJECT_ID;
    process.env.ZITADEL_PROJECT_ID = 'seller-project-999';

    const config = getZitadelConfig();
    expect(config.projectId).toBe('seller-project-999');
    expect(config.scopes).toContain('urn:zitadel:iam:org:project:id:seller-project-999:aud');
    expect(config.scopes).not.toContain('urn:zitadel:iam:org:project:id:zitadel:aud');

    if (previousProjectId !== undefined) process.env.ZITADEL_PROJECT_ID = previousProjectId;
    else delete process.env.ZITADEL_PROJECT_ID;
  });
});

import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  createActorSession,
  getActorSession,
  destroyActorSession,
  clearMemoryStore,
  ensureRedisReady,
  type ActorSessionData,
} from '../lib/auth/session-store';
import {
  parseSessionCookie,
  serializeSessionCookie,
  encodeSignedCookieValue,
  decodeSignedCookieValue,
} from '../lib/auth/session-cookie';

describe('Auth Session Store & Cookie Security (T005)', () => {
  beforeEach(() => {
    clearMemoryStore();
  });

  it('creates and retrieves an actor session from store', async () => {
    const sessionData: Omit<ActorSessionData, 'sessionId'> = {
      sub: 'usr_seller_a_owner',
      email: 'owner-a@matjerhub.test',
      name: 'Seller A Owner',
      roles: ['seller_owner'],
      accessToken: 'access_token_12345',
      expiresAt: Date.now() + 3600 * 1000,
    };

    const session = await createActorSession(sessionData);
    expect(session.sessionId).toBeDefined();
    expect(session.sessionId.length).toBeGreaterThan(10);

    const retrieved = await getActorSession(session.sessionId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.sub).toBe('usr_seller_a_owner');
    expect(retrieved?.accessToken).toBe('access_token_12345');
  });

  it('prevents retrieval of expired actor sessions', async () => {
    const expiredData: Omit<ActorSessionData, 'sessionId'> = {
      sub: 'usr_seller_expired',
      email: 'expired@matjerhub.test',
      name: 'Expired User',
      roles: ['seller_staff'],
      accessToken: 'expired_token',
      expiresAt: Date.now() - 1000, // already expired
    };

    const session = await createActorSession(expiredData);
    const retrieved = await getActorSession(session.sessionId);
    expect(retrieved).toBeNull();
  });

  it('revokes session on destroyActorSession', async () => {
    const sessionData: Omit<ActorSessionData, 'sessionId'> = {
      sub: 'usr_seller_revoke',
      email: 'revoke@matjerhub.test',
      name: 'Revoked User',
      roles: ['seller_manager'],
      accessToken: 'active_token',
      expiresAt: Date.now() + 3600 * 1000,
    };

    const session = await createActorSession(sessionData);
    await destroyActorSession(session.sessionId);

    const retrieved = await getActorSession(session.sessionId);
    expect(retrieved).toBeNull();
  });

  it('ensures opaque cookie string contains no plaintext access token or raw subject', async () => {
    const sessionData: Omit<ActorSessionData, 'sessionId'> = {
      sub: 'usr_seller_secret_sub',
      email: 'secret@matjerhub.test',
      name: 'Secret User',
      roles: ['seller_owner'],
      accessToken: 'super_secret_access_token_xyz',
      expiresAt: Date.now() + 3600 * 1000,
    };

    const session = await createActorSession(sessionData);
    const cookieValue = await serializeSessionCookie(session.sessionId);

    // Verify cookie does not contain access token or raw subject text
    expect(cookieValue).not.toContain('super_secret_access_token_xyz');
    expect(cookieValue).not.toContain('usr_seller_secret_sub');
  });

  it('rejects tampered signed session cookies', async () => {
    const validValue = await encodeSignedCookieValue('valid-session-id');
    const parts = validValue.split('.');
    const tamperedValue = `${parts[0]}.invalid_signature`;

    await expect(decodeSignedCookieValue(tamperedValue)).rejects.toThrow();
  });

  it('connects lazy Redis clients before issuing session commands', async () => {
    const redis = {
      status: 'wait' as const,
      connect: vi.fn(async () => {}),
    };

    await expect(ensureRedisReady(redis)).resolves.toBe(true);
    expect(redis.connect).toHaveBeenCalledTimes(1);
  });
});

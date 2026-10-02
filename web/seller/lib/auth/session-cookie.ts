import { getActorSession } from './session-store';

export const sessionCookieName = 'mh_seller_session';

export interface SellerUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  roles: string[];
  tenantId?: string;
}

export interface SellerSession {
  isAuthenticated: boolean;
  user: SellerUser | null;
  expiresAt: number | null;
  sessionId?: string;
  accessToken?: string;
}

export function createEmptySession(): SellerSession {
  return {
    isAuthenticated: false,
    user: null,
    expiresAt: null,
  };
}

export async function parseSessionCookie(cookieValue?: string | null): Promise<SellerSession> {
  if (!cookieValue) {
    return createEmptySession();
  }

  try {
    const raw = await decodeSignedCookieValue<any>(cookieValue);
    if (!raw) {
      return createEmptySession();
    }

    if (typeof raw === 'string') {
      const actorSession = await getActorSession(raw);
      if (!actorSession) {
        return createEmptySession();
      }

      return {
        isAuthenticated: true,
        user: {
          id: actorSession.sub,
          email: actorSession.email,
          name: actorSession.name,
          avatarUrl: actorSession.avatarUrl,
          roles: actorSession.roles,
        },
        expiresAt: actorSession.expiresAt,
        sessionId: actorSession.sessionId,
        accessToken: actorSession.accessToken,
      };
    }

    if (raw.isAuthenticated && raw.user) {
      if (raw.expiresAt && raw.expiresAt < Date.now()) {
        return createEmptySession();
      }
      return raw as SellerSession;
    }

    return createEmptySession();
  } catch {
    return createEmptySession();
  }
}

export async function serializeSessionCookie(payload: SellerSession | string): Promise<string> {
  if (typeof payload === 'string') {
    return encodeSignedCookieValue(payload);
  }
  if (payload.sessionId) {
    return encodeSignedCookieValue(payload.sessionId);
  }
  return encodeSignedCookieValue(payload);
}

export function encodeCookieValue(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeCookieValue<T>(value: string): T {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

export async function encodeSignedCookieValue(payload: unknown): Promise<string> {
  const encodedPayload = encodeCookieValue(payload);
  const signature = await signCookiePayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function decodeSignedCookieValue<T>(value: string): Promise<T> {
  const [encodedPayload, signature] = value.split('.');
  if (!encodedPayload || !signature) {
    throw new Error('Malformed signed cookie');
  }

  const expectedSignature = await signCookiePayload(encodedPayload);
  if (!constantTimeEquals(signature, expectedSignature)) {
    throw new Error('Invalid signed cookie');
  }

  return decodeCookieValue<T>(encodedPayload);
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.SELLER_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required in production');
  }

  return 'dev-only-seller-session-secret-32-bytes-long';
}

async function signCookiePayload(encodedPayload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
  return encodeBytes(new Uint8Array(signature));
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function constantTimeEquals(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

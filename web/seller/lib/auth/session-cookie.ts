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
}

export function createEmptySession(): SellerSession {
  return {
    isAuthenticated: false,
    user: null,
    expiresAt: null
  };
}

export async function parseSessionCookie(value?: string | null): Promise<SellerSession> {
  if (!value) {
    return createEmptySession();
  }

  try {
    const parsed = await decodeSignedCookieValue<SellerSession>(value);
    if (!parsed.isAuthenticated || !parsed.user) {
      return createEmptySession();
    }

    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      return createEmptySession();
    }

    return parsed;
  } catch {
    return createEmptySession();
  }
}

export async function serializeSessionCookie(session: SellerSession) {
  return encodeSignedCookieValue(session);
}

export function encodeCookieValue(payload: unknown) {
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

export async function encodeSignedCookieValue(payload: unknown) {
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

function getSessionSecret() {
  const secret = process.env.SELLER_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SELLER_SESSION_SECRET is required in production');
  }

  return 'dev-only-seller-session-secret';
}

async function signCookiePayload(encodedPayload: string) {
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

function encodeBytes(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function constantTimeEquals(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

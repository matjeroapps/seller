import { cookies } from 'next/headers';

import {
  createEmptySession,
  decodeSignedCookieValue,
  encodeSignedCookieValue,
  parseSessionCookie,
  serializeSessionCookie,
  sessionCookieName,
  type SellerSession
} from './session-cookie';

const sessionMaxAge = 60 * 60 * 12;

export async function getCurrentSession(): Promise<SellerSession> {
  const cookieStore = await cookies();
  return parseSessionCookie(cookieStore.get(sessionCookieName)?.value);
}

export async function getCurrentUser() {
  const session = await getCurrentSession();
  return session.user;
}

export async function setCurrentSession(session: SellerSession) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, await serializeSessionCookie(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: sessionMaxAge,
    path: '/'
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}

export async function clearAuthTransaction() {
  const cookieStore = await cookies();
  cookieStore.delete(authTransactionCookieName);
}

export const authTransactionCookieName = 'mh_seller_auth_tx';

export interface AuthTransaction {
  state: string;
  codeVerifier: string;
  redirectTo: string;
}

export async function setAuthTransaction(transaction: AuthTransaction) {
  const cookieStore = await cookies();
  cookieStore.set(authTransactionCookieName, await encodeSignedCookieValue(transaction), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60,
    path: '/'
  });
}

export async function getAuthTransaction(): Promise<AuthTransaction | null> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(authTransactionCookieName)?.value;
  if (!cookieValue) {
    return null;
  }

  try {
    const transaction = await decodeSignedCookieValue<AuthTransaction>(cookieValue);
    if (!transaction.state || !transaction.codeVerifier || !transaction.redirectTo) {
      return null;
    }

    return transaction;
  } catch {
    return null;
  }
}

export function emptySession() {
  return createEmptySession();
}

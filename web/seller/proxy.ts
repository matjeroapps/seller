import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { parseSessionCookie, sessionCookieName } from './lib/auth/session-cookie';

const protectedRoutes = ['/dashboard'];
const publicOnlyRoutes = ['/login'];

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isProtectedRoute(pathname: string) {
  return protectedRoutes.some((route) => matchesRoute(pathname, route));
}

function isPublicOnlyRoute(pathname: string) {
  return publicOnlyRoutes.some((route) => matchesRoute(pathname, route));
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/_next') || pathname.includes('.') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  const session = await parseSessionCookie(request.cookies.get(sessionCookieName)?.value);

  if (isProtectedRoute(pathname) && !session.isAuthenticated) {
    return redirectToLogin(request);
  }

  if (isPublicOnlyRoute(pathname) && session.isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};

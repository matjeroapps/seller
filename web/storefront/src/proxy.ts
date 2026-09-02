import { NextResponse, type NextRequest } from 'next/server';

import { locales } from './i18n/locales';
import { INTERNAL_HEADER_PREFIX, LOCALE_HEADER, PATH_HEADER } from './lib/headers';

/**
 * Request interception.
 *
 * In Next.js 16 the `middleware` file convention was renamed to `proxy`; the build
 * warns that `middleware.ts` is deprecated and names `proxy.ts` as its replacement.
 * This file is that convention, and it does exactly two things.
 *
 * First, it strips every inbound `x-matjero-*` request header. Those headers are this
 * application's own channel from the proxy to the render, so a client must not be
 * able to supply one. They are deleted before any is set.
 *
 * Second, it publishes the current path. A root layout sits above the `[locale]`
 * segment and has no access to the pathname, yet it must set `lang` and `dir` on the
 * document, and the store chrome must build a locale switch that lands on the
 * equivalent page. Both need the path, and this is the supported way to give it to
 * them.
 *
 * Tenant identity is deliberately *not* resolved here. The host is read from the
 * request during rendering, where the store bootstrap it produces can be reused by
 * the page instead of being fetched once in the proxy and again in the render.
 */

export function proxy(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) {
    if (name.toLowerCase().startsWith(INTERNAL_HEADER_PREFIX)) {
      headers.delete(name);
    }
  }

  const segments = request.nextUrl.pathname.split('/').filter((segment) => segment !== '');
  const [first, ...rest] = segments;

  if (first !== undefined && (locales as readonly string[]).includes(first)) {
    headers.set(LOCALE_HEADER, first);
    // The path within the locale, which is what a locale switch has to preserve.
    headers.set(PATH_HEADER, rest.length > 0 ? `/${rest.join('/')}` : '');
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Framework assets and the favicon need no interception.
  matcher: ['/((?!_next/|favicon.ico).*)']
};

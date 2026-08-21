import { NextResponse, type NextRequest } from 'next/server';
import { api } from '@/lib/api';
import { ACCESS_COOKIE, REFRESH_COOKIE, sessionCookieOptions } from '@/lib/session';

const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Paths that make no sense without a session. Everything else may be read anonymously. */
const PRIVATE_PREFIXES = ['/cabinet', '/admin'];

/**
 * Keeps the fifteen-minute access token fresh for the pages that read it.
 * Doing it here rather than in each page is what lets a server component
 * simply read the cookie: by the time it runs, the cookie is valid, or the
 * visitor is anonymous and the page knows it.
 *
 * The teacher and group pages are public but still run through here: someone
 * with a live refresh token who lands on a booking screen must be recognised,
 * or the calendar would tell them to sign in while they already are.
 */
export async function proxy(request: NextRequest) {
  const isPrivate = PRIVATE_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix));

  if (request.cookies.get(ACCESS_COOKIE)) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return isPrivate ? redirectToLogin(request) : NextResponse.next();
  }

  // A prefetch must not spend the refresh token. Rotation invalidates the old
  // one, and two requests racing with the same token look exactly like a
  // stolen token being replayed - which costs the visitor every session.
  if (request.headers.get('next-router-prefetch')) {
    return NextResponse.next();
  }

  try {
    const session = await api.refresh(refreshToken);

    // Set on the outgoing request too, so the page rendered by *this* request
    // already sees the new token instead of one render as an anonymous user.
    request.cookies.set(ACCESS_COOKIE, session.accessToken);

    const response = NextResponse.next({ request: { headers: request.headers } });
    response.cookies.set(
      ACCESS_COOKIE,
      session.accessToken,
      sessionCookieOptions(session.accessTokenExpiresIn),
    );
    response.cookies.set(
      REFRESH_COOKIE,
      session.refreshToken,
      sessionCookieOptions(REFRESH_MAX_AGE_SECONDS),
    );
    return response;
  } catch {
    const response = isPrivate ? redirectToLogin(request) : NextResponse.next();
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = new URL('/login', request.url);
  // Comes back to the page they were trying to open, so a session that ran
  // out mid-booking does not cost them their place in the flow.
  url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/cabinet/:path*', '/admin/:path*', '/teachers/:path*', '/groups/:path*'],
};

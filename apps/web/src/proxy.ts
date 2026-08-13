import { NextResponse, type NextRequest } from 'next/server';
import { api } from '@/lib/api';
import { ACCESS_COOKIE, REFRESH_COOKIE, sessionCookieOptions } from '@/lib/session';

const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Keeps the fifteen-minute access token fresh for the pages behind a login.
 * Doing it here rather than in each page is what lets a server component
 * simply read the cookie: by the time it runs, the cookie is valid or the
 * visitor has already been sent to the login screen.
 */
export async function proxy(request: NextRequest) {
  if (request.cookies.get(ACCESS_COOKIE)) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return redirectToLogin(request);
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
    const response = redirectToLogin(request);
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = new URL('/login', request.url);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/cabinet/:path*'],
};

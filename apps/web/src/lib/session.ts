import type { AuthResponse } from '@palitra/shared';
import { cookies } from 'next/headers';

export const ACCESS_COOKIE = 'pt_access';
export const REFRESH_COOKIE = 'pt_refresh';

/** Matches the refresh token lifetime in the API. */
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * `httpOnly` is the whole point of routing the browser's session through the
 * Next server: the API hands tokens back in the response body because the
 * mobile client will need them that way, but on the web they are put straight
 * into cookies no script can read, so an XSS cannot walk off with a refresh
 * token good for thirty days.
 *
 * `sameSite: lax` still sends the cookie on a link from an email - which is
 * exactly how the verification and reset flows arrive.
 */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  } as const;
}

export async function startSession(auth: AuthResponse): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, auth.accessToken, sessionCookieOptions(auth.accessTokenExpiresIn));
  store.set(REFRESH_COOKIE, auth.refreshToken, sessionCookieOptions(REFRESH_MAX_AGE_SECONDS));
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function readAccessToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_COOKIE)?.value ?? null;
}

export async function readRefreshToken(): Promise<string | null> {
  return (await cookies()).get(REFRESH_COOKIE)?.value ?? null;
}

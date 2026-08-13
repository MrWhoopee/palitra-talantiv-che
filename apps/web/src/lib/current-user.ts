import type { PublicUser } from '@palitra/shared';
import { api } from '@/lib/api';
import { readAccessToken } from '@/lib/session';

/**
 * Resolves the visitor from the access cookie on every render rather than
 * trusting a decoded token: the middleware has already refreshed an expired
 * one, and asking the API keeps a suspended or renamed account from lingering
 * in the interface for the fifteen minutes a token stays valid.
 */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const accessToken = await readAccessToken();
  if (!accessToken) {
    return null;
  }

  try {
    return await api.getMe(accessToken);
  } catch {
    return null;
  }
}

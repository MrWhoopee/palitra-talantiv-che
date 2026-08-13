import { compare, hash } from 'bcryptjs';

/**
 * OWASP's current recommendation for bcrypt. `bcryptjs` is a pure-JS
 * implementation, so this costs roughly 400ms per hash instead of the ~100ms a
 * native build would take - acceptable at this traffic, and the async API
 * yields to the event loop between rounds rather than blocking it.
 */
export const DEFAULT_BCRYPT_COST = 12;

export function hashPassword(plain: string, cost: number = DEFAULT_BCRYPT_COST): Promise<string> {
  return hash(plain, cost);
}

export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  try {
    return await compare(plain, passwordHash);
  } catch {
    // A malformed hash (a half-finished migration, a hand-edited row) must
    // read as a failed login. Letting it throw would answer with a 500 only
    // for accounts that exist, which is an account-enumeration oracle.
    return false;
  }
}

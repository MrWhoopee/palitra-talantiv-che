import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;

export interface OpaqueToken {
  /** Handed to the client once and never stored. */
  token: string;
  /** What the database keeps, so a dump cannot be replayed as a session. */
  tokenHash: string;
}

export function createOpaqueToken(): OpaqueToken {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashOpaqueToken(token) };
}

/**
 * Plain SHA-256, not bcrypt. The input is 32 random bytes, so there is no
 * dictionary for an attacker to walk and no salt to add - and lookups by
 * digest happen on every refresh, where a deliberately slow hash would only
 * slow down the studio.
 */
export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

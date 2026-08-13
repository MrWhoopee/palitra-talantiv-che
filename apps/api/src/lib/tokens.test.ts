import { describe, expect, it } from 'vitest';
import { createOpaqueToken, hashOpaqueToken } from './tokens';

describe('createOpaqueToken', () => {
  it('returns a url-safe token and its digest', () => {
    const { token, tokenHash } = createOpaqueToken();

    // The token travels inside email links, so anything needing escaping
    // would break the link in some mail clients.
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(tokenHash).toBe(hashOpaqueToken(token));
  });

  it('carries at least 256 bits of entropy', () => {
    const { token } = createOpaqueToken();

    expect(Buffer.from(token, 'base64url').length).toBeGreaterThanOrEqual(32);
  });

  it('never repeats itself', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => createOpaqueToken().token));

    expect(tokens.size).toBe(500);
  });

  it('does not let the digest be turned back into the token', () => {
    const { token, tokenHash } = createOpaqueToken();

    expect(tokenHash).not.toContain(token);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('hashOpaqueToken', () => {
  it('is deterministic, so a presented token can be looked up by digest', () => {
    expect(hashOpaqueToken('some-token')).toBe(hashOpaqueToken('some-token'));
  });

  it('separates tokens that differ by a single character', () => {
    expect(hashOpaqueToken('some-token')).not.toBe(hashOpaqueToken('some-tokeo'));
  });
});

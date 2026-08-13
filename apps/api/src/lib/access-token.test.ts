import { describe, expect, it } from 'vitest';
import { createAccessTokenService } from './access-token';

const secret = 'a'.repeat(32);
const claims = { userId: '3f1d0c62-9c2a-4a1f-8a9a-3f0f9a1b2c3d', role: 'STUDENT' } as const;

function service(overrides: { secret?: string; ttlSeconds?: number } = {}) {
  return createAccessTokenService({ secret, ttlSeconds: 900, ...overrides });
}

describe('access token round-trip', () => {
  it('returns the same claims it signed', async () => {
    const tokens = service();

    const verified = await tokens.verify(await tokens.sign(claims));

    expect(verified).toEqual(claims);
  });

  it('exposes its lifetime so the client knows when to refresh', () => {
    expect(service().ttlSeconds).toBe(900);
  });
});

describe('access token rejection', () => {
  it('rejects a token signed with a different secret', async () => {
    const token = await service({ secret: 'b'.repeat(32) }).sign(claims);

    await expect(service().verify(token)).resolves.toBeNull();
  });

  it('rejects a token whose payload was edited', async () => {
    const tokens = service();
    const [header, payload, signature] = (await tokens.sign(claims)).split('.');
    const edited = JSON.parse(Buffer.from(payload!, 'base64url').toString()) as Record<
      string,
      unknown
    >;
    edited['role'] = 'ADMIN';
    const forged = [
      header,
      Buffer.from(JSON.stringify(edited)).toString('base64url'),
      signature,
    ].join('.');

    await expect(tokens.verify(forged)).resolves.toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await service({ ttlSeconds: -1 }).sign(claims);

    await expect(service().verify(token)).resolves.toBeNull();
  });

  it('rejects garbage instead of throwing', async () => {
    const tokens = service();

    await expect(tokens.verify('')).resolves.toBeNull();
    await expect(tokens.verify('not.a.jwt')).resolves.toBeNull();
    await expect(tokens.verify('Bearer something')).resolves.toBeNull();
  });

  it('rejects a well-signed token carrying an unknown role', async () => {
    // Roles come from the shared union; a token minted before a role was
    // removed must stop working rather than land in `requireRole` unchecked.
    const tokens = service();
    const token = await tokens.sign({ ...claims, role: 'SUPERUSER' as never });

    await expect(tokens.verify(token)).resolves.toBeNull();
  });
});

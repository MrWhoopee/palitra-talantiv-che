import type { UserRole } from '@palitra/shared';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createAccessTokenService } from '../../lib/access-token';
import { DomainError } from '../error-handler';
import { createRequireAuth, requireRole } from './auth';

const accessTokens = createAccessTokenService({ secret: 'a'.repeat(32), ttlSeconds: 900 });
const claims = { userId: '3f1d0c62-9c2a-4a1f-8a9a-3f0f9a1b2c3d', role: 'STUDENT' } as const;

function fakeRequest(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

async function runRequireAuth(headers: Record<string, string> = {}) {
  const req = fakeRequest(headers);
  const next = vi.fn();

  await createRequireAuth(accessTokens)(req, {} as Response, next);

  return { req, next, error: next.mock.calls[0]?.[0] as unknown };
}

describe('requireAuth', () => {
  it('attaches the claims of a valid token', async () => {
    const token = await accessTokens.sign(claims);

    const { req, next, error } = await runRequireAuth({ authorization: `Bearer ${token}` });

    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
    expect(req.auth).toEqual(claims);
  });

  it('rejects a request with no authorization header', async () => {
    const { error } = await runRequireAuth();

    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('UNAUTHENTICATED');
  });

  it('rejects a token sent without the Bearer scheme', async () => {
    const token = await accessTokens.sign(claims);

    const { error } = await runRequireAuth({ authorization: token });

    expect((error as DomainError).code).toBe('UNAUTHENTICATED');
  });

  it('rejects a forged token', async () => {
    const forged = await createAccessTokenService({
      secret: 'b'.repeat(32),
      ttlSeconds: 900,
    }).sign({ ...claims, role: 'ADMIN' });

    const { req, error } = await runRequireAuth({ authorization: `Bearer ${forged}` });

    expect((error as DomainError).code).toBe('UNAUTHENTICATED');
    expect(req.auth).toBeUndefined();
  });

  it('rejects an expired token', async () => {
    const expired = await createAccessTokenService({
      secret: 'a'.repeat(32),
      ttlSeconds: -1,
    }).sign(claims);

    const { error } = await runRequireAuth({ authorization: `Bearer ${expired}` });

    expect((error as DomainError).code).toBe('UNAUTHENTICATED');
  });
});

describe('requireRole', () => {
  function run(auth: unknown, roles: UserRole[]) {
    const req = { headers: {}, auth } as unknown as Request;
    const next = vi.fn();

    requireRole(...roles)(req, {} as Response, next);

    return next.mock.calls[0]?.[0] as unknown;
  }

  it('lets a matching role through', () => {
    expect(run({ ...claims, role: 'TEACHER' }, ['TEACHER', 'ADMIN'])).toBeUndefined();
  });

  it('answers 403 for an authenticated user with the wrong role', () => {
    const error = run(claims, ['ADMIN']);

    expect((error as DomainError).code).toBe('FORBIDDEN');
  });

  it('answers 401, not 403, when the request was never authenticated', () => {
    // Reaching this without `requireAuth` in front is a wiring mistake; the
    // client still has to hear "log in", not "you are not allowed".
    const error = run(undefined, ['ADMIN']);

    expect((error as DomainError).code).toBe('UNAUTHENTICATED');
  });
});

import { describe, expect, it } from 'vitest';
import { DOMAIN_ERROR_CODES, DOMAIN_ERROR_STATUS, apiErrorSchema } from './errors';

describe('domain error codes', () => {
  it('maps every code to an http error status', () => {
    for (const code of DOMAIN_ERROR_CODES) {
      expect(DOMAIN_ERROR_STATUS[code]).toBeGreaterThanOrEqual(400);
      expect(DOMAIN_ERROR_STATUS[code]).toBeLessThan(600);
    }
  });

  it('treats every code except INTERNAL_ERROR as a client error', () => {
    const serverErrorCodes = DOMAIN_ERROR_CODES.filter((code) => DOMAIN_ERROR_STATUS[code] >= 500);
    expect(serverErrorCodes).toEqual(['INTERNAL_ERROR']);
  });

  it('has no duplicate codes', () => {
    expect(new Set(DOMAIN_ERROR_CODES).size).toBe(DOMAIN_ERROR_CODES.length);
  });

  it('reports a taken slot as a conflict', () => {
    expect(DOMAIN_ERROR_STATUS.SLOT_TAKEN).toBe(409);
  });

  it('reports a duplicate registration as a conflict', () => {
    expect(DOMAIN_ERROR_STATUS.EMAIL_TAKEN).toBe(409);
  });

  it('answers bad credentials and bad tokens with 401, not 403', () => {
    // 403 would mean "authenticated but not allowed", which tells a caller
    // probing for accounts that the password was the only thing missing.
    expect(DOMAIN_ERROR_STATUS.INVALID_CREDENTIALS).toBe(401);
    expect(DOMAIN_ERROR_STATUS.INVALID_TOKEN).toBe(401);
  });
});

describe('apiErrorSchema', () => {
  it('accepts a minimal error body', () => {
    const parsed = apiErrorSchema.parse({ code: 'SLOT_TAKEN', message: 'Слот щойно зайняли' });
    expect(parsed.code).toBe('SLOT_TAKEN');
    expect(parsed.details).toBeUndefined();
  });

  it('rejects an unknown code', () => {
    expect(() => apiErrorSchema.parse({ code: 'NOPE', message: 'x' })).toThrow();
  });
});

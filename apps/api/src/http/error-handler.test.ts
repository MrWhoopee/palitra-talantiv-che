import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { DomainError, errorHandler } from './error-handler';

function fakeResponse() {
  const captured: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      captured.status = code;
      return res;
    },
    json(body: unknown) {
      captured.body = body;
      return res;
    },
  };
  return { res: res as unknown as Response, captured };
}

describe('errorHandler', () => {
  it('maps a domain error to its configured status and code', () => {
    const { res, captured } = fakeResponse();

    errorHandler(new DomainError('SLOT_TAKEN', 'Слот щойно зайняли'), {} as never, res, vi.fn());

    expect(captured.status).toBe(409);
    expect(captured.body).toEqual({ code: 'SLOT_TAKEN', message: 'Слот щойно зайняли' });
  });

  it('includes details when the domain error carries them', () => {
    const { res, captured } = fakeResponse();

    errorHandler(
      new DomainError('VALIDATION_FAILED', 'Invalid body', { field: 'email' }),
      {} as never,
      res,
      vi.fn(),
    );

    expect(captured.body).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Invalid body',
      details: { field: 'email' },
    });
  });

  it('hides the message of an unexpected error behind a 500', () => {
    const { res, captured } = fakeResponse();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(
      new Error('connect ECONNREFUSED postgres://palitra:palitra@localhost'),
      {} as never,
      res,
      vi.fn(),
    );

    expect(captured.status).toBe(500);
    expect(captured.body).toEqual({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
    expect(JSON.stringify(captured.body)).not.toContain('palitra');
    consoleSpy.mockRestore();
  });
});

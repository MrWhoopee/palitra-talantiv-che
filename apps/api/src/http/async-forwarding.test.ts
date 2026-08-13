import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { DomainError, errorHandler } from './error-handler';

/**
 * The API has no `asyncHandler` wrapper and no try/catch in routes because
 * Express 5 automatically forwards a rejected promise from an async handler
 * to the error middleware. If that stopped being true, every route in every
 * later stage would silently answer with Express's default HTML stack-trace
 * page instead of the JSON error envelope — and unless something exercises
 * a real rejecting handler through a real Express app, the rest of the test
 * suite would stay green while that happened. This test builds a throwaway
 * app (never `createApp`) purely to prove the auto-forwarding behaviour.
 */
function buildThrowawayApp(): express.Express {
  const app = express();

  app.get('/domain-error', async () => {
    throw new DomainError('SLOT_TAKEN', 'Слот щойно зайняли');
  });

  app.get('/plain-error', async () => {
    throw new Error('connect ECONNREFUSED postgres://palitra:palitra@localhost');
  });

  app.use(errorHandler);

  return app;
}

describe('Express 5 async rejection forwarding', () => {
  it('forwards a rejected DomainError to the error handler as JSON', async () => {
    const app = buildThrowawayApp();

    const response = await request(app).get('/domain-error');

    expect(response.status).toBe(409);
    expect(response.type).toBe('application/json');
    expect(response.body).toEqual({ code: 'SLOT_TAKEN', message: 'Слот щойно зайняли' });
    expect(response.text).not.toContain('<html');
  });

  it('forwards a rejected plain Error to the error handler as a masked 500', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = buildThrowawayApp();

    const response = await request(app).get('/plain-error');

    expect(response.status).toBe(500);
    expect(response.type).toBe('application/json');
    expect(response.body).toEqual({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
    expect(response.text).not.toContain('<html');
    expect(response.text).not.toContain('ECONNREFUSED');
    expect(response.text).not.toContain('palitra');
    consoleSpy.mockRestore();
  });
});

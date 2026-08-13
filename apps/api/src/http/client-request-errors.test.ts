import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app';

/**
 * body-parser raises malformed/oversized body errors with a numeric 4xx
 * `status` and `expose: true` - already classified as the client's fault.
 * These go through the real app (not a throwaway one, unlike
 * async-forwarding.test.ts) because the behaviour under test is the
 * `express.json()` middleware installed by `createApp` itself, including
 * its configured 1mb limit.
 */
describe('client request errors reaching express.json()', () => {
  it('maps a malformed JSON body to a 4xx domain error instead of a 500', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp({ checkDatabase: async () => true });

    const response = await request(app)
      .post('/health')
      .set('content-type', 'application/json')
      .send('{not valid json');

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('maps an oversized JSON body to its own status instead of a 500', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp({ checkDatabase: async () => true });
    const oversizedPayload = JSON.stringify({ data: 'x'.repeat(2 * 1024 * 1024) });

    const response = await request(app)
      .post('/health')
      .set('content-type', 'application/json')
      .send(oversizedPayload);

    expect(response.status).toBe(413);
    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

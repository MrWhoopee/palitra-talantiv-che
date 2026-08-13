import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health';

describe('healthResponseSchema', () => {
  it('accepts a healthy response', () => {
    const parsed = healthResponseSchema.parse({
      status: 'ok',
      uptimeSeconds: 12.5,
      database: 'up',
    });
    expect(parsed.database).toBe('up');
  });

  it('accepts a response with the database down', () => {
    const parsed = healthResponseSchema.parse({
      status: 'degraded',
      uptimeSeconds: 0,
      database: 'down',
    });
    expect(parsed.status).toBe('degraded');
  });

  it('rejects a negative uptime', () => {
    expect(() =>
      healthResponseSchema.parse({ status: 'ok', uptimeSeconds: -1, database: 'up' }),
    ).toThrow();
  });

  it('rejects an unknown database state', () => {
    expect(() =>
      healthResponseSchema.parse({ status: 'ok', uptimeSeconds: 1, database: 'maybe' }),
    ).toThrow();
  });
});

import { healthResponseSchema } from '@palitra/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../http/app.js';

describe('GET /health', () => {
  it('reports ok when the database is reachable', async () => {
    const app = createApp({ checkDatabase: async () => true });

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    const body = healthResponseSchema.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.database).toBe('up');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('reports degraded with status 503 when the database is unreachable', async () => {
    const app = createApp({ checkDatabase: async () => false });

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    const body = healthResponseSchema.parse(response.body);
    expect(body.status).toBe('degraded');
    expect(body.database).toBe('down');
  });

  it('reports degraded when the database check throws', async () => {
    const app = createApp({
      checkDatabase: async () => {
        throw new Error('connection refused');
      },
    });

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.database).toBe('down');
  });

  it('returns a NOT_FOUND error body for unknown routes', async () => {
    const app = createApp({ checkDatabase: async () => true });

    const response = await request(app).get('/nope');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});

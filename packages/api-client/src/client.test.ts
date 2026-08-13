import { describe, expect, it } from 'vitest';
import { ApiClientError, createApiClient } from './client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createApiClient', () => {
  it('requests the health endpoint on the configured base url', async () => {
    const calls: string[] = [];
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async (input) => {
        calls.push(String(input));
        return jsonResponse({ status: 'ok', uptimeSeconds: 1, database: 'up' });
      },
    });

    const health = await client.getHealth();

    expect(calls).toEqual(['http://api.test/health']);
    expect(health.status).toBe('ok');
  });

  it('strips a trailing slash from the base url', async () => {
    const calls: string[] = [];
    const client = createApiClient({
      baseUrl: 'http://api.test/',
      fetch: async (input) => {
        calls.push(String(input));
        return jsonResponse({ status: 'ok', uptimeSeconds: 1, database: 'up' });
      },
    });

    await client.getHealth();

    expect(calls).toEqual(['http://api.test/health']);
  });

  it('throws ApiClientError carrying the domain code on an error response', async () => {
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async () => jsonResponse({ code: 'NOT_FOUND', message: 'Route not found' }, 404),
    });

    await expect(client.getHealth()).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('throws when the payload does not match the schema', async () => {
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async () => jsonResponse({ status: 'fine', uptimeSeconds: 1, database: 'up' }),
    });

    await expect(client.getHealth()).rejects.toBeInstanceOf(ApiClientError);
  });

  it('falls back to BAD_RESPONSE when an error response body does not match apiErrorSchema', async () => {
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async () => jsonResponse({ oops: 'not an error shape' }, 502),
    });

    let caught: unknown;
    try {
      await client.getHealth();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiClientError);
    const error = caught as ApiClientError;
    expect(error.code).toBe('BAD_RESPONSE');
    expect(error.status).toBe(502);
    expect(error).not.toHaveProperty('issues');
    expect(error.name).not.toBe('ZodError');
  });
});

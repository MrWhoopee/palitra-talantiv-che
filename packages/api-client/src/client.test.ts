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

  it('reports the real response status on a schema mismatch, not a hardcoded 200', async () => {
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch: async () => jsonResponse({ status: 'fine', uptimeSeconds: 1, database: 'up' }, 201),
    });

    await expect(client.getHealth()).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'BAD_RESPONSE',
      status: 201,
    });
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

const authResponse = {
  user: {
    id: 'c0e5f3a2-1b4d-4c8e-9f7a-2d6b8e0a1c34',
    email: 'olena@example.com',
    role: 'STUDENT',
    firstName: 'Олена',
    lastName: 'Коваль',
    phone: '+380671234567',
    emailVerifiedAt: null,
  },
  accessToken: 'header.payload.signature',
  refreshToken: 'a'.repeat(43),
  accessTokenExpiresIn: 900,
};

interface RecordedCall {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
  body: unknown;
}

function recordingClient(respond: () => Response) {
  const calls: RecordedCall[] = [];
  const client = createApiClient({
    baseUrl: 'http://api.test',
    fetch: async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method,
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      return respond();
    },
  });
  return { client, calls };
}

describe('auth requests', () => {
  it('posts the credentials as json', async () => {
    const { client, calls } = recordingClient(() => jsonResponse(authResponse));

    await client.login({ email: 'olena@example.com', password: 'correct horse battery' });

    expect(calls[0]?.url).toBe('http://api.test/auth/login');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.headers['content-type']).toBe('application/json');
    expect(calls[0]?.body).toEqual({
      email: 'olena@example.com',
      password: 'correct horse battery',
    });
  });

  it('sends the access token as a bearer header', async () => {
    const { client, calls } = recordingClient(() => jsonResponse(authResponse.user));

    await client.getMe('an-access-token');

    expect(calls[0]?.headers['authorization']).toBe('Bearer an-access-token');
  });

  it('never puts the refresh token in the url, where it would land in server logs', async () => {
    const { client, calls } = recordingClient(() => jsonResponse(authResponse));

    await client.refresh('a-refresh-token');

    expect(calls[0]?.url).not.toContain('a-refresh-token');
    expect(calls[0]?.body).toEqual({ refreshToken: 'a-refresh-token' });
  });

  it('accepts an empty 204 body', async () => {
    // Parsing a body that is not there would reject, turning a successful
    // logout into an error the user sees.
    const { client } = recordingClient(() => new Response(null, { status: 204 }));

    await expect(client.logout('a-refresh-token')).resolves.toBeUndefined();
  });

  it('exposes per-field messages from a validation error', async () => {
    const { client } = recordingClient(() =>
      jsonResponse(
        {
          code: 'VALIDATION_FAILED',
          message: 'Перевірте заповнені поля',
          details: { email: ['Некоректна адреса електронної пошти'], notAnArray: 'ignored' },
        },
        400,
      ),
    );

    let caught: unknown;
    try {
      await client.register({
        email: 'nope',
        password: 'correct horse battery',
        firstName: 'Олена',
        lastName: 'Коваль',
        phone: '+380671234567',
      });
    } catch (thrown) {
      caught = thrown;
    }

    expect(caught).toBeInstanceOf(ApiClientError);
    const error = caught as ApiClientError;
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.fieldErrors['email']).toEqual(['Некоректна адреса електронної пошти']);
    expect(error.fieldErrors).not.toHaveProperty('notAnArray');
  });
});

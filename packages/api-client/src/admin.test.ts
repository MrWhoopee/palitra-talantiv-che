import { describe, expect, it } from 'vitest';
import { createAdminClient } from './admin';
import { ApiClientError } from './http';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const teacher = {
  id: '0195c8a0-0000-7000-8000-000000000002',
  firstName: 'Ірина',
  lastName: 'Шевченко',
  bio: null,
  experienceYears: null,
  photoUrl: null,
  directions: [],
  locations: [],
  email: 'iryna@example.com',
  phone: '+380671112233',
  isPublished: false,
  isActive: true,
  sortOrder: 0,
  hasPassword: false,
};

describe('createAdminClient', () => {
  it('sends the token with every request', async () => {
    const headers: (string | null)[] = [];
    const client = createAdminClient({
      baseUrl: 'http://api.test',
      fetch: async (_input, init) => {
        headers.push(new Headers(init?.headers).get('authorization'));
        return jsonResponse([teacher]);
      },
    });

    await client.getTeachers('token-abc');

    // Nothing here is readable without one: the staff list carries every
    // teacher's address and phone.
    expect(headers).toEqual(['Bearer token-abc']);
  });

  it('asks the guarded path, not the public one', async () => {
    const calls: string[] = [];
    const client = createAdminClient({
      baseUrl: 'http://api.test',
      fetch: async (input) => {
        calls.push(String(input));
        return jsonResponse([]);
      },
    });

    await client.getTeachers('token-abc');
    await client.getSiteTexts('token-abc');

    expect(calls).toEqual(['http://api.test/admin/teachers', 'http://api.test/admin/site-texts']);
  });

  it('raises the same error the public client raises', async () => {
    const client = createAdminClient({
      baseUrl: 'http://api.test',
      fetch: async () => jsonResponse({ code: 'FORBIDDEN', message: 'Недостатньо прав' }, 403),
    });

    // One error type for both clients: a screen that catches a failure does
    // not care which of them the request went through.
    await expect(client.getTeachers('token-abc')).rejects.toBeInstanceOf(ApiClientError);
  });

  it('refuses a payload that is not the shape it asked for', async () => {
    const client = createAdminClient({
      baseUrl: 'http://api.test',
      fetch: async () => jsonResponse([{ id: 'not-a-uuid' }]),
    });

    await expect(client.getTeachers('token-abc')).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
  });
});

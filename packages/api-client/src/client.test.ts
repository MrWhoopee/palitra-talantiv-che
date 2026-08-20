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

describe('teacher and availability requests', () => {
  const teacherId = '019880d3-0000-7000-8000-000000000001';
  const locationId = '019880d3-0000-7000-8000-000000000002';

  it('builds the slot query string', async () => {
    const { client, calls } = recordingClient(() =>
      jsonResponse({ teacherId, durationMinutes: 45, slots: [] }),
    );

    const response = await client.getSlots(teacherId, {
      from: '2026-09-01',
      to: '2026-09-28',
      duration: 45,
    });

    expect(calls[0]?.url).toBe(
      `http://api.test/teachers/${teacherId}/slots?from=2026-09-01&to=2026-09-28&duration=45`,
    );
    expect(response.durationMinutes).toBe(45);
  });

  it('sends the access token when writing a working rule', async () => {
    const rule = {
      id: '019880d3-0000-7000-8000-000000000003',
      teacherId,
      locationId,
      weekday: 2,
      startTime: '10:00',
      endTime: '18:00',
      validFrom: '2026-09-01',
      validTo: null,
    };
    const { client, calls } = recordingClient(() => jsonResponse(rule, 201));

    await client.createAvailabilityRule(
      teacherId,
      {
        locationId,
        weekday: 2,
        startTime: '10:00',
        endTime: '18:00',
        validFrom: '2026-09-01',
      },
      'an-access-token',
    );

    expect(calls[0]?.url).toBe(`http://api.test/teachers/${teacherId}/availability/rules`);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.headers['authorization']).toBe('Bearer an-access-token');
  });

  it('deletes a rule without expecting a body back', async () => {
    const { client, calls } = recordingClient(() => new Response(null, { status: 204 }));

    await expect(
      client.deleteAvailabilityRule(teacherId, 'rule-id', 'an-access-token'),
    ).resolves.toBeUndefined();

    expect(calls[0]?.method).toBe('DELETE');
    expect(calls[0]?.url).toBe(`http://api.test/teachers/${teacherId}/availability/rules/rule-id`);
  });

  it('rejects a slots payload that does not match the contract', async () => {
    const { client } = recordingClient(() => jsonResponse({ teacherId, slots: 'nope' }));

    await expect(
      client.getSlots(teacherId, { from: '2026-09-01', to: '2026-09-02', duration: 60 }),
    ).rejects.toBeInstanceOf(ApiClientError);
  });
});

describe('booking requests', () => {
  const lesson = {
    id: '019880d3-0000-7000-8000-00000000000a',
    startsAt: '2026-09-02T07:00:00.000Z',
    endsAt: '2026-09-02T08:00:00.000Z',
    durationMinutes: 60,
    kind: 'TRIAL',
    status: 'PENDING',
    cancelReason: null,
    teacher: {
      id: '019880d3-0000-7000-8000-00000000000b',
      firstName: 'Ірина',
      lastName: 'Мельник',
    },
    student: {
      id: '019880d3-0000-7000-8000-00000000000c',
      firstName: 'Олена',
      lastName: 'Коваль',
      phone: '+380671234567',
    },
    location: {
      id: '019880d3-0000-7000-8000-00000000000d',
      name: 'Благовісна',
      address: 'вул. Благовісна, 170',
    },
    group: null,
    directionName: 'Вокал',
    subscriptionId: null,
  };

  it('posts a booking with the session token', async () => {
    const { client, calls } = recordingClient(() => jsonResponse(lesson, 201));

    const created = await client.createBooking(
      {
        teacherId: lesson.teacher.id,
        locationId: lesson.location.id,
        pricePlanId: '019880d3-0000-7000-8000-00000000000e',
        startsAt: lesson.startsAt,
        kind: 'TRIAL',
      },
      'an-access-token',
    );

    expect(calls[0]?.url).toBe('http://api.test/bookings');
    expect(calls[0]?.headers['authorization']).toBe('Bearer an-access-token');
    expect(created.status).toBe('PENDING');
  });

  it('sends an empty object when a cancellation has no reason', async () => {
    const { client, calls } = recordingClient(() =>
      jsonResponse({ ...lesson, status: 'CANCELLED' }),
    );

    await client.cancelLesson(lesson.id, {}, 'an-access-token');

    expect(calls[0]?.url).toBe(`http://api.test/lessons/${lesson.id}/cancel`);
    expect(calls[0]?.body).toEqual({});
  });

  it('passes a waived charge through to the api', async () => {
    const { client, calls } = recordingClient(() =>
      jsonResponse({ ...lesson, status: 'CANCELLED' }),
    );

    await client.cancelLesson(lesson.id, { waiveCharge: true }, 'an-access-token');

    expect(calls[0]?.body).toEqual({ waiveCharge: true });
  });
});

describe('groups and the register', () => {
  const group = {
    id: '019880d3-0000-7000-8000-00000000001a',
    name: 'Вокальний ансамбль',
    teacher: {
      id: '019880d3-0000-7000-8000-00000000000b',
      firstName: 'Ірина',
      lastName: 'Мельник',
    },
    direction: {
      id: '019880d3-0000-7000-8000-00000000001b',
      slug: 'vocal',
      name: 'Вокал',
      description: null,
      icon: null,
    },
    location: {
      id: '019880d3-0000-7000-8000-00000000000d',
      name: 'Благовісна',
      address: 'вул. Благовісна, 170',
      mapUrl: null,
    },
    capacity: 8,
    durationMinutes: 60,
    isOpenForEnrollment: true,
    startsOn: '2026-09-02',
    endsOn: null,
    schedule: [{ weekday: 3, startTime: '17:00' }],
    seatsTaken: 2,
    seatsLeft: 6,
  };

  it('reads the open groups without a token', async () => {
    const { client, calls } = recordingClient(() => jsonResponse([group]));

    const groups = await client.getGroups();

    expect(calls[0]?.url).toBe('http://api.test/groups');
    expect(calls[0]?.headers['authorization']).toBeUndefined();
    expect(groups[0]?.name).toBe('Вокальний ансамбль');
  });

  it('applies to a group with the session token', async () => {
    const enrollment = {
      id: '019880d3-0000-7000-8000-00000000001c',
      groupId: group.id,
      student: {
        id: '019880d3-0000-7000-8000-00000000000c',
        firstName: 'Олена',
        lastName: 'Коваль',
        phone: '+380671234567',
      },
      status: 'PENDING',
      joinedAt: '2026-09-01T09:00:00.000Z',
      leftAt: null,
    };
    const { client, calls } = recordingClient(() => jsonResponse(enrollment, 201));

    const applied = await client.applyToGroup(group.id, 'an-access-token');

    expect(calls[0]?.url).toBe(`http://api.test/groups/${group.id}/enrollments`);
    expect(calls[0]?.headers['authorization']).toBe('Bearer an-access-token');
    expect(applied.status).toBe('PENDING');
  });

  it('saves the register on the teacher`s own lesson path', async () => {
    const lessonId = '019880d3-0000-7000-8000-00000000001d';
    const studentId = '019880d3-0000-7000-8000-00000000000c';
    const register = {
      lessonId,
      groupId: group.id,
      groupName: group.name,
      startsAt: '2026-09-02T14:00:00.000Z',
      entries: [
        {
          student: {
            id: studentId,
            firstName: 'Олена',
            lastName: 'Коваль',
            phone: '+380671234567',
          },
          status: 'PRESENT',
        },
      ],
    };
    const { client, calls } = recordingClient(() => jsonResponse(register));

    const saved = await client.saveAttendance(
      lessonId,
      { entries: [{ studentId, status: 'PRESENT' }] },
      'an-access-token',
    );

    expect(calls[0]?.url).toBe(`http://api.test/me/lessons/${lessonId}/attendance`);
    expect(calls[0]?.method).toBe('PUT');
    expect(saved.entries[0]?.status).toBe('PRESENT');
  });
});

describe('subscriptions', () => {
  const subscription = {
    id: '019880d3-0000-7000-8000-00000000002a',
    student: {
      id: '019880d3-0000-7000-8000-00000000000c',
      firstName: 'Олена',
      lastName: 'Коваль',
      phone: '+380671234567',
    },
    teacher: {
      id: '019880d3-0000-7000-8000-00000000000b',
      firstName: 'Ірина',
      lastName: 'Мельник',
    },
    directionName: 'Вокал',
    planName: 'Абонемент 8 занять',
    durationMinutes: 45,
    lessonsTotal: 8,
    lessonsUsed: 2,
    lessonsReserved: 1,
    lessonsLeft: 5,
    priceUah: 2800,
    validFrom: '2026-09-01',
    validTo: '2026-11-30',
    paidAt: '2026-09-01T09:00:00.000Z',
    status: 'ACTIVE',
  };

  it('reads the caller`s own packages', async () => {
    const { client, calls } = recordingClient(() => jsonResponse([subscription]));

    const rows = await client.getMySubscriptions('an-access-token');

    expect(calls[0]?.url).toBe('http://api.test/me/subscriptions');
    expect(rows[0]?.lessonsLeft).toBe(5);
  });

  it('marks a package paid', async () => {
    const { client, calls } = recordingClient(() => jsonResponse(subscription));

    await client.markSubscriptionPaid(subscription.id, 'an-access-token');

    expect(calls[0]?.url).toBe(`http://api.test/subscriptions/${subscription.id}/paid`);
    expect(calls[0]?.method).toBe('POST');
  });
});

import {
  availabilityRuleSchema,
  formatLocalDate,
  formatTimeOfDay,
  fromZonedTime,
  parseLocalDate,
  parseTimeOfDay,
  slotsResponseSchema,
  toLocalDate,
  toZonedParts,
  weekdayOf,
} from '@palitra/shared';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../http/app';
import { createAccessTokenService } from '../../lib/access-token';
import { createTestPrisma, resetDatabase } from '../../test/database';
import { createLocation, createRule, createTeacher, createUser } from '../../test/fixtures';
import { createAvailabilityRouter } from './availability.router';
import { createAvailabilityService } from './availability.service';

const prisma = createTestPrisma();
const accessTokens = createAccessTokenService({ secret: 'test-secret'.repeat(4), ttlSeconds: 900 });

/**
 * A fixed clock, so "in the past" and "past the horizon" mean the same thing
 * on every run. 2026-09-01 is a Tuesday, 09:00 in Kyiv.
 */
const NOW = new Date('2026-09-01T06:00:00Z');

/** Moved by the one test that needs to look at October. */
let clock = NOW;

const app: Express = createApp({
  checkDatabase: async () => true,
  routers: [
    createAvailabilityRouter({
      availability: createAvailabilityService({ prisma, now: () => clock }),
      accessTokens,
    }),
  ],
});

beforeEach(async () => {
  clock = NOW;
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

function tokenFor(userId: string, role: 'ADMIN' | 'TEACHER' | 'STUDENT' = 'TEACHER') {
  return accessTokens.sign({ userId, role });
}

function kyiv(day: string, time: string): Date {
  return fromZonedTime(
    parseLocalDate(day) ?? { year: 2026, month: 1, day: 1 },
    parseTimeOfDay(time) ?? 0,
  );
}

function localTimes(slots: { startsAt: string }[]): string[] {
  return slots.map((slot) => {
    const startsAt = new Date(slot.startsAt);
    return `${formatLocalDate(toLocalDate(startsAt))} ${formatTimeOfDay(toZonedParts(startsAt).minuteOfDay)}`;
  });
}

async function setUpTeacher() {
  const location = await createLocation(prisma);
  const teacher = await createTeacher(prisma, { locationIds: [location.id] });
  return { teacher, location };
}

describe('GET /teachers/:id/slots', () => {
  it('turns a weekly rule into bookable windows', async () => {
    const { teacher, location } = await setUpTeacher();
    // Wednesday, so the whole day is ahead of the fixed clock.
    await createRule(prisma, {
      teacherId: teacher.id,
      locationId: location.id,
      on: '2026-09-02',
      from: '10:00',
      to: '12:00',
    });

    const response = await request(app)
      .get(`/teachers/${teacher.id}/slots`)
      .query({ from: '2026-09-02', to: '2026-09-02', duration: 60 });

    expect(response.status).toBe(200);
    const body = slotsResponseSchema.parse(response.body);
    expect(body.durationMinutes).toBe(60);
    expect(localTimes(body.slots)).toStrictEqual([
      '2026-09-02 10:00',
      '2026-09-02 10:15',
      '2026-09-02 10:30',
      '2026-09-02 10:45',
      '2026-09-02 11:00',
    ]);
    expect(body.slots.every((slot) => slot.locationId === location.id)).toBe(true);
  });

  it('never offers a slot that has already started', async () => {
    const { teacher, location } = await setUpTeacher();
    // Today, 08:00-12:00 local, against a clock reading 09:00.
    await createRule(prisma, {
      teacherId: teacher.id,
      locationId: location.id,
      on: '2026-09-01',
      from: '08:00',
      to: '12:00',
    });

    const response = await request(app)
      .get(`/teachers/${teacher.id}/slots`)
      .query({ from: '2026-09-01', to: '2026-09-01', duration: 60 });

    expect(localTimes(slotsResponseSchema.parse(response.body).slots)).toStrictEqual([
      '2026-09-01 09:00',
      '2026-09-01 09:15',
      '2026-09-01 09:30',
      '2026-09-01 09:45',
      '2026-09-01 10:00',
      '2026-09-01 10:15',
      '2026-09-01 10:30',
      '2026-09-01 10:45',
      '2026-09-01 11:00',
    ]);
  });

  it('stops at the four-week booking horizon', async () => {
    const { teacher, location } = await setUpTeacher();
    await createRule(prisma, {
      teacherId: teacher.id,
      locationId: location.id,
      on: '2026-09-02',
      from: '10:00',
      to: '11:00',
    });

    const response = await request(app)
      .get(`/teachers/${teacher.id}/slots`)
      .query({ from: '2026-09-01', to: '2026-10-15', duration: 60 });

    // Four Wednesdays: 2, 9, 16, 23. The 30th is past the horizon, which ends
    // on 2026-09-29.
    expect(localTimes(slotsResponseSchema.parse(response.body).slots)).toStrictEqual([
      '2026-09-02 10:00',
      '2026-09-09 10:00',
      '2026-09-16 10:00',
      '2026-09-23 10:00',
    ]);
  });

  it('cuts a holiday out of the windows', async () => {
    const { teacher, location } = await setUpTeacher();
    await createRule(prisma, {
      teacherId: teacher.id,
      locationId: location.id,
      on: '2026-09-02',
      from: '10:00',
      to: '12:00',
    });
    await prisma.availabilityException.create({
      data: {
        teacherId: teacher.id,
        startsAt: kyiv('2026-09-02', '10:00'),
        endsAt: kyiv('2026-09-02', '11:00'),
        kind: 'VACATION',
      },
    });

    const response = await request(app)
      .get(`/teachers/${teacher.id}/slots`)
      .query({ from: '2026-09-02', to: '2026-09-02', duration: 60 });

    expect(localTimes(slotsResponseSchema.parse(response.body).slots)).toStrictEqual([
      '2026-09-02 11:00',
    ]);
  });

  it('keeps the wall-clock hour across the autumn time change', async () => {
    clock = new Date('2026-10-19T06:00:00Z');
    const { teacher, location } = await setUpTeacher();
    await createRule(prisma, {
      teacherId: teacher.id,
      locationId: location.id,
      on: '2026-10-20',
      from: '17:00',
      to: '18:00',
    });

    const response = await request(app)
      .get(`/teachers/${teacher.id}/slots`)
      .query({ from: '2026-10-20', to: '2026-10-28', duration: 60 });

    const body = slotsResponseSchema.parse(response.body);
    // The clocks go back on 25 October. Both lessons start at 17:00 in Kyiv -
    // and are an hour apart in UTC, which is the whole reason rules store a
    // local time of day rather than an instant.
    expect(localTimes(body.slots)).toStrictEqual(['2026-10-20 17:00', '2026-10-27 17:00']);
    expect(body.slots[0]?.startsAt).toBe('2026-10-20T14:00:00.000Z');
    expect(body.slots[1]?.startsAt).toBe('2026-10-27T15:00:00.000Z');
  });

  it('answers 404 for a teacher that does not exist', async () => {
    const response = await request(app)
      .get('/teachers/019880d3-0000-7000-8000-00000000dead/slots')
      .query({ from: '2026-09-02', to: '2026-09-02', duration: 60 });

    expect(response.status).toBe(404);
  });

  it('rejects a duration the studio does not sell', async () => {
    const { teacher } = await setUpTeacher();

    const response = await request(app)
      .get(`/teachers/${teacher.id}/slots`)
      .query({ from: '2026-09-02', to: '2026-09-02', duration: 25 });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(response.body.details.duration).toBeDefined();
  });

  it('rejects a range wider than the query limit', async () => {
    const { teacher } = await setUpTeacher();

    const response = await request(app)
      .get(`/teachers/${teacher.id}/slots`)
      .query({ from: '2026-01-01', to: '2026-12-31', duration: 60 });

    expect(response.status).toBe(400);
  });

  it('needs no session', async () => {
    const { teacher, location } = await setUpTeacher();
    await createRule(prisma, {
      teacherId: teacher.id,
      locationId: location.id,
      on: '2026-09-02',
      from: '10:00',
      to: '11:00',
    });

    const response = await request(app)
      .get(`/teachers/${teacher.id}/slots`)
      .query({ from: '2026-09-02', to: '2026-09-02', duration: 60 });

    expect(response.status).toBe(200);
  });
});

describe('working rules', () => {
  const validRule = (locationId: string) => ({
    locationId,
    weekday: weekdayOf(parseLocalDate('2026-09-02') ?? { year: 2026, month: 9, day: 2 }),
    startTime: '10:00',
    endTime: '18:00',
    validFrom: '2026-09-01',
  });

  it('lets a teacher create, list, replace and delete their own rules', async () => {
    const { teacher, location } = await setUpTeacher();
    const token = await tokenFor(teacher.id);

    const created = await request(app)
      .post(`/teachers/${teacher.id}/availability/rules`)
      .set('authorization', `Bearer ${token}`)
      .send(validRule(location.id));

    expect(created.status).toBe(201);
    const rule = availabilityRuleSchema.parse(created.body);
    expect(rule.startTime).toBe('10:00');
    expect(rule.validTo).toBeNull();

    const replaced = await request(app)
      .put(`/teachers/${teacher.id}/availability/rules/${rule.id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ ...validRule(location.id), endTime: '16:00', validTo: '2026-12-31' });

    expect(replaced.status).toBe(200);
    expect(availabilityRuleSchema.parse(replaced.body).endTime).toBe('16:00');
    expect(replaced.body.validTo).toBe('2026-12-31');

    const listed = await request(app)
      .get(`/teachers/${teacher.id}/availability/rules`)
      .set('authorization', `Bearer ${token}`);

    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);

    const removed = await request(app)
      .delete(`/teachers/${teacher.id}/availability/rules/${rule.id}`)
      .set('authorization', `Bearer ${token}`);

    expect(removed.status).toBe(204);
    await expect(prisma.availabilityRule.count()).resolves.toBe(0);
  });

  it('keeps the calendar date it was given, whatever the reader`s zone', async () => {
    const { teacher, location } = await setUpTeacher();
    const token = await tokenFor(teacher.id);

    const created = await request(app)
      .post(`/teachers/${teacher.id}/availability/rules`)
      .set('authorization', `Bearer ${token}`)
      .send({ ...validRule(location.id), validFrom: '2026-09-01', validTo: '2026-09-30' });

    expect(created.body.validFrom).toBe('2026-09-01');
    expect(created.body.validTo).toBe('2026-09-30');
  });

  it('refuses to touch another teacher`s schedule', async () => {
    const { location } = await setUpTeacher();
    const other = await createTeacher(prisma, { locationIds: [location.id] });
    const intruder = await createTeacher(prisma);
    const token = await tokenFor(intruder.id);

    const response = await request(app)
      .post(`/teachers/${other.id}/availability/rules`)
      .set('authorization', `Bearer ${token}`)
      .send(validRule(location.id));

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('NOT_TEACHER_OWNED');
    await expect(prisma.availabilityRule.count()).resolves.toBe(0);
  });

  it('will not delete a rule that belongs to someone else', async () => {
    const { teacher, location } = await setUpTeacher();
    const rule = await createRule(prisma, {
      teacherId: teacher.id,
      locationId: location.id,
      on: '2026-09-02',
      from: '10:00',
      to: '18:00',
    });
    const admin = await createUser(prisma, { role: 'ADMIN' });

    // The admin is allowed at the teacher's schedule, but the rule id has to
    // belong to the teacher named in the path.
    const response = await request(app)
      .delete(`/teachers/${admin.id}/availability/rules/${rule.id}`)
      .set('authorization', `Bearer ${await tokenFor(admin.id, 'ADMIN')}`);

    expect(response.status).toBe(404);
    await expect(prisma.availabilityRule.count()).resolves.toBe(1);
  });

  it('lets an admin edit any schedule', async () => {
    const { teacher, location } = await setUpTeacher();
    const admin = await createUser(prisma, { role: 'ADMIN' });

    const response = await request(app)
      .post(`/teachers/${teacher.id}/availability/rules`)
      .set('authorization', `Bearer ${await tokenFor(admin.id, 'ADMIN')}`)
      .send(validRule(location.id));

    expect(response.status).toBe(201);
  });

  it('needs a session', async () => {
    const { teacher, location } = await setUpTeacher();

    const response = await request(app)
      .post(`/teachers/${teacher.id}/availability/rules`)
      .send(validRule(location.id));

    expect(response.status).toBe(401);
  });

  it('rejects a window that ends before it starts', async () => {
    const { teacher, location } = await setUpTeacher();

    const response = await request(app)
      .post(`/teachers/${teacher.id}/availability/rules`)
      .set('authorization', `Bearer ${await tokenFor(teacher.id)}`)
      .send({ ...validRule(location.id), startTime: '18:00', endTime: '10:00' });

    expect(response.status).toBe(400);
    expect(response.body.details.endTime).toBeDefined();
  });

  it('rejects a location that does not exist', async () => {
    const { teacher } = await setUpTeacher();

    const response = await request(app)
      .post(`/teachers/${teacher.id}/availability/rules`)
      .set('authorization', `Bearer ${await tokenFor(teacher.id)}`)
      .send(validRule('019880d3-0000-7000-8000-00000000beef'));

    expect(response.status).toBe(404);
  });
});

describe('exceptions', () => {
  it('records and removes a holiday', async () => {
    const { teacher } = await setUpTeacher();
    const token = await tokenFor(teacher.id);

    const created = await request(app)
      .post(`/teachers/${teacher.id}/availability/exceptions`)
      .set('authorization', `Bearer ${token}`)
      .send({
        startsAt: '2026-09-10T07:00:00.000Z',
        endsAt: '2026-09-20T07:00:00.000Z',
        kind: 'VACATION',
        note: 'Відпустка',
      });

    expect(created.status).toBe(201);
    expect(created.body.kind).toBe('VACATION');
    expect(created.body.note).toBe('Відпустка');

    const listed = await request(app)
      .get(`/teachers/${teacher.id}/availability/exceptions`)
      .set('authorization', `Bearer ${token}`);

    expect(listed.body).toHaveLength(1);

    const removed = await request(app)
      .delete(`/teachers/${teacher.id}/availability/exceptions/${created.body.id}`)
      .set('authorization', `Bearer ${token}`);

    expect(removed.status).toBe(204);
  });

  it('rejects a range that ends before it starts', async () => {
    const { teacher } = await setUpTeacher();

    const response = await request(app)
      .post(`/teachers/${teacher.id}/availability/exceptions`)
      .set('authorization', `Bearer ${await tokenFor(teacher.id)}`)
      .send({
        startsAt: '2026-09-20T07:00:00.000Z',
        endsAt: '2026-09-10T07:00:00.000Z',
        kind: 'SICK',
      });

    expect(response.status).toBe(400);
  });

  it('refuses to read another teacher`s holidays', async () => {
    const { teacher } = await setUpTeacher();
    const intruder = await createTeacher(prisma);

    const response = await request(app)
      .get(`/teachers/${teacher.id}/availability/exceptions`)
      .set('authorization', `Bearer ${await tokenFor(intruder.id)}`);

    expect(response.status).toBe(403);
  });
});

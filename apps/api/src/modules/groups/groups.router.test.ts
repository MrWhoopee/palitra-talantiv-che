import {
  fromZonedTime,
  groupEnrollmentSchema,
  groupSaveResultSchema,
  lessonAttendanceSchema,
  lessonListSchema,
  parseLocalDate,
  parseTimeOfDay,
  slotsResponseSchema,
  type Lesson,
} from '@palitra/shared';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../http/app';
import { createAccessTokenService } from '../../lib/access-token';
import { createMemoryMailer } from '../../lib/mailer';
import { createAvailabilityRouter } from '../availability/availability.router';
import { createAvailabilityService } from '../availability/availability.service';
import { createBookingRouter } from '../booking/booking.router';
import { createBookingService } from '../booking/booking.service';
import { createSubscriptionService } from '../subscriptions/subscriptions.service';
import { createTestPrisma, resetDatabase } from '../../test/database';
import {
  createDirection,
  createLocation,
  createPricePlan,
  createRule,
  createTeacher,
  createUser,
} from '../../test/fixtures';
import { createGroupsRouter } from './groups.router';
import { createGroupsService } from './groups.service';

const prisma = createTestPrisma();
const accessTokens = createAccessTokenService({ secret: 'test-secret'.repeat(4), ttlSeconds: 900 });
const mailer = createMemoryMailer();

/** Tuesday 2026-09-01, 09:00 in Kyiv. */
const NOW = new Date('2026-09-01T06:00:00Z');
let clock = NOW;

const availability = createAvailabilityService({ prisma, now: () => clock });
const subscriptions = createSubscriptionService({ prisma, now: () => clock });

const app: Express = createApp({
  checkDatabase: async () => true,
  routers: [
    createGroupsRouter({ groups: createGroupsService({ prisma, now: () => clock }), accessTokens }),
    createAvailabilityRouter({ availability, accessTokens }),
    createBookingRouter({
      booking: createBookingService({
        prisma,
        availability,
        subscriptions,
        mailer,
        webOrigin: 'http://localhost:3000',
        now: () => clock,
      }),
      accessTokens,
    }),
  ],
});

beforeEach(async () => {
  clock = NOW;
  mailer.clear();
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

function tokenFor(userId: string, role: 'ADMIN' | 'TEACHER' | 'STUDENT' = 'STUDENT') {
  return accessTokens.sign({ userId, role });
}

function kyiv(day: string, time: string): Date {
  return fromZonedTime(
    parseLocalDate(day) ?? { year: 2026, month: 1, day: 1 },
    parseTimeOfDay(time) ?? 0,
  );
}

/** A teacher working Wednesdays 10:00-14:00 and two students. */
async function studio() {
  const location = await createLocation(prisma);
  const direction = await createDirection(prisma);
  const teacher = await createTeacher(prisma, { locationIds: [location.id] });
  const plan = await createPricePlan(prisma, { directionId: direction.id, durationMinutes: 60 });
  await createRule(prisma, {
    teacherId: teacher.id,
    locationId: location.id,
    on: '2026-09-02',
    from: '10:00',
    to: '14:00',
  });

  return {
    location,
    direction,
    teacher,
    plan,
    teacherToken: await tokenFor(teacher.id, 'TEACHER'),
    first: await createUser(prisma, { firstName: 'Ігор' }),
    second: await createUser(prisma, { firstName: 'Соломія' }),
  };
}

type Studio = Awaited<ReturnType<typeof studio>>;

function groupBody(setup: Studio, overrides: Record<string, unknown> = {}) {
  return {
    name: 'Вокальний ансамбль',
    directionId: setup.direction.id,
    locationId: setup.location.id,
    capacity: 2,
    durationMinutes: 60,
    startsOn: '2026-09-02',
    endsOn: '2026-09-30',
    // Wednesdays at 11:00, inside the teacher's working window.
    schedule: [{ weekday: 3, startTime: '11:00' }],
    ...overrides,
  };
}

async function createGroup(setup: Studio, overrides: Record<string, unknown> = {}) {
  const response = await request(app)
    .post('/groups')
    .set('authorization', `Bearer ${setup.teacherToken}`)
    .send(groupBody(setup, overrides));

  return { status: response.status, body: response.body as unknown };
}

async function lessonsOf(userId: string, role: 'TEACHER' | 'STUDENT' = 'STUDENT') {
  const response = await request(app)
    .get('/me/lessons')
    .set('authorization', `Bearer ${await tokenFor(userId, role)}`);

  return lessonListSchema.parse(response.body);
}

async function apply(groupId: string, studentId: string) {
  return request(app)
    .post(`/groups/${groupId}/enrollments`)
    .set('authorization', `Bearer ${await tokenFor(studentId)}`);
}

async function approve(setup: Studio, groupId: string, enrollmentId: string) {
  return request(app)
    .post(`/groups/${groupId}/enrollments/${enrollmentId}/approve`)
    .set('authorization', `Bearer ${setup.teacherToken}`);
}

describe('POST /groups', () => {
  it('turns the timetable into real meetings', async () => {
    const setup = await studio();

    const created = await createGroup(setup);

    expect(created.status).toBe(201);
    const result = groupSaveResultSchema.parse(created.body);
    // Wednesdays from 2 September to 30 September: five of them.
    expect(result.generatedLessons).toBe(5);
    expect(result.skippedOccurrences).toEqual([]);
    expect(result.group.seatsLeft).toBe(2);
    expect(result.group.schedule).toEqual([{ weekday: 3, startTime: '11:00' }]);

    const teacherLessons = await lessonsOf(setup.teacher.id, 'TEACHER');
    const meetings = teacherLessons.filter((lesson) => lesson.group !== null);
    expect(meetings).toHaveLength(5);
    // A group meeting has no student on it - it belongs to the group.
    expect(meetings[0]?.student).toBeNull();
    expect(meetings[0]?.group?.name).toBe('Вокальний ансамбль');
    expect(meetings[0]?.status).toBe('CONFIRMED');
  });

  it('takes the group`s hour out of the individual calendar', async () => {
    const setup = await studio();
    await createGroup(setup);

    const response = await request(app)
      .get(`/teachers/${setup.teacher.id}/slots`)
      .query({ from: '2026-09-02', to: '2026-09-02', duration: 60 });

    const starts = slotsResponseSchema.parse(response.body).slots.map((slot) => slot.startsAt);
    // The group meets 11:00-12:00, so nothing may start between 10:15 and 12:00.
    expect(starts).toContain(kyiv('2026-09-02', '10:00').toISOString());
    expect(starts).toContain(kyiv('2026-09-02', '12:00').toISOString());
    expect(starts).not.toContain(kyiv('2026-09-02', '11:00').toISOString());
    expect(starts).not.toContain(kyiv('2026-09-02', '10:30').toISOString());
  });

  it('skips a meeting the teacher is already busy for, and says which', async () => {
    const setup = await studio();
    const student = setup.first;

    // An individual lesson on the first Wednesday, at the hour the group wants.
    const booked = await request(app)
      .post('/bookings')
      .set('authorization', `Bearer ${await tokenFor(student.id)}`)
      .send({
        teacherId: setup.teacher.id,
        locationId: setup.location.id,
        pricePlanId: setup.plan.id,
        startsAt: kyiv('2026-09-02', '11:00').toISOString(),
        kind: 'TRIAL',
      });
    expect(booked.status).toBe(201);

    const created = await createGroup(setup);
    const result = groupSaveResultSchema.parse(created.body);

    expect(result.generatedLessons).toBe(4);
    expect(result.skippedOccurrences).toEqual([kyiv('2026-09-02', '11:00').toISOString()]);
  });

  it('refuses a group for somebody else', async () => {
    const setup = await studio();
    const other = await createTeacher(prisma, { locationIds: [setup.location.id] });

    const response = await request(app)
      .post('/groups')
      .set('authorization', `Bearer ${await tokenFor(other.id, 'TEACHER')}`)
      .send(groupBody(setup, { teacherId: setup.teacher.id }));

    expect(response.status).toBe(403);
  });

  it('is not something a student may do', async () => {
    const setup = await studio();

    const response = await request(app)
      .post('/groups')
      .set('authorization', `Bearer ${await tokenFor(setup.first.id)}`)
      .send(groupBody(setup));

    expect(response.status).toBe(403);
  });
});

describe('PUT /groups/:id', () => {
  it('rebuilds the meetings ahead and leaves the ones behind alone', async () => {
    const setup = await studio();
    const created = await createGroup(setup);
    const groupId = groupSaveResultSchema.parse(created.body).group.id;

    // Two Wednesdays later: the first two meetings are history now.
    clock = kyiv('2026-09-16', '13:00');

    const updated = await request(app)
      .put(`/groups/${groupId}`)
      .set('authorization', `Bearer ${setup.teacherToken}`)
      .send(groupBody(setup, { schedule: [{ weekday: 3, startTime: '12:00' }] }));

    expect(updated.status).toBe(200);
    const result = groupSaveResultSchema.parse(updated.body);
    expect(result.group.schedule).toEqual([{ weekday: 3, startTime: '12:00' }]);
    // 23 and 30 September remain ahead.
    expect(result.generatedLessons).toBe(2);

    const meetings = (await lessonsOf(setup.teacher.id, 'TEACHER')).filter(
      (lesson) => lesson.group !== null,
    );
    const times = meetings.map((lesson) => lesson.startsAt);
    // The past keeps its eleven o'clock; the future moved to twelve.
    expect(times).toContain(kyiv('2026-09-02', '11:00').toISOString());
    expect(times).toContain(kyiv('2026-09-09', '11:00').toISOString());
    expect(times).toContain(kyiv('2026-09-23', '12:00').toISOString());
    expect(times).not.toContain(kyiv('2026-09-23', '11:00').toISOString());
  });
});

describe('enrolling in a group', () => {
  it('holds a place from the application, not from the approval', async () => {
    const setup = await studio();
    const groupId = groupSaveResultSchema.parse((await createGroup(setup)).body).group.id;

    const applied = await apply(groupId, setup.first.id);
    expect(applied.status).toBe(201);
    expect(groupEnrollmentSchema.parse(applied.body).status).toBe('PENDING');

    const group = await request(app).get(`/groups/${groupId}`);
    expect(group.body.seatsTaken).toBe(1);
    expect(group.body.seatsLeft).toBe(1);
  });

  it('refuses a second application from the same person', async () => {
    const setup = await studio();
    const groupId = groupSaveResultSchema.parse((await createGroup(setup)).body).group.id;

    await apply(groupId, setup.first.id);
    const again = await apply(groupId, setup.first.id);

    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_ENROLLED');
  });

  it('refuses once the group is full', async () => {
    const setup = await studio();
    const groupId = groupSaveResultSchema.parse((await createGroup(setup, { capacity: 2 })).body)
      .group.id;
    const third = await createUser(prisma);

    await apply(groupId, setup.first.id);
    await apply(groupId, setup.second.id);
    const full = await apply(groupId, third.id);

    expect(full.status).toBe(409);
    expect(full.body.code).toBe('GROUP_FULL');
  });

  it('refuses a group that is not taking anyone', async () => {
    const setup = await studio();
    const groupId = groupSaveResultSchema.parse(
      (await createGroup(setup, { isOpenForEnrollment: false })).body,
    ).group.id;

    expect((await apply(groupId, setup.first.id)).status).toBe(400);
  });

  it('puts the group`s meetings in the cabinet once the teacher approves', async () => {
    const setup = await studio();
    const groupId = groupSaveResultSchema.parse((await createGroup(setup)).body).group.id;
    const applied = await apply(groupId, setup.first.id);

    // A pending application is not membership yet.
    expect((await lessonsOf(setup.first.id)).filter(isGroupLesson)).toHaveLength(0);

    const approved = await approve(setup, groupId, applied.body.id);
    expect(groupEnrollmentSchema.parse(approved.body).status).toBe('ACTIVE');

    expect((await lessonsOf(setup.first.id)).filter(isGroupLesson)).toHaveLength(5);
  });

  it('refuses to let another teacher approve', async () => {
    const setup = await studio();
    const groupId = groupSaveResultSchema.parse((await createGroup(setup)).body).group.id;
    const applied = await apply(groupId, setup.first.id);
    const other = await createTeacher(prisma, { locationIds: [setup.location.id] });

    const response = await request(app)
      .post(`/groups/${groupId}/enrollments/${applied.body.id}/approve`)
      .set('authorization', `Bearer ${await tokenFor(other.id, 'TEACHER')}`);

    expect(response.status).toBe(403);
  });

  it('gives the place back when somebody leaves', async () => {
    const setup = await studio();
    const groupId = groupSaveResultSchema.parse((await createGroup(setup)).body).group.id;
    const third = await createUser(prisma);

    const applied = await apply(groupId, setup.first.id);
    await apply(groupId, setup.second.id);
    expect((await apply(groupId, third.id)).body.code).toBe('GROUP_FULL');

    const left = await request(app)
      .post(`/groups/${groupId}/enrollments/${applied.body.id}/remove`)
      .set('authorization', `Bearer ${await tokenFor(setup.first.id)}`);

    expect(groupEnrollmentSchema.parse(left.body).status).toBe('LEFT');
    expect((await apply(groupId, third.id)).status).toBe(201);
    expect((await request(app).get(`/groups/${groupId}`)).body.seatsLeft).toBe(0);
  });

  it('lets somebody who left apply again to the same group', async () => {
    // One row per person per group, reused - the unique index is what makes a
    // second application impossible, so coming back has to update, not insert.
    const setup = await studio();
    const groupId = groupSaveResultSchema.parse((await createGroup(setup)).body).group.id;

    const applied = await apply(groupId, setup.first.id);
    await request(app)
      .post(`/groups/${groupId}/enrollments/${applied.body.id}/remove`)
      .set('authorization', `Bearer ${await tokenFor(setup.first.id)}`);

    const again = await apply(groupId, setup.first.id);
    expect(again.status).toBe(201);
    expect(again.body.id).toBe(applied.body.id);
    expect(groupEnrollmentSchema.parse(again.body).leftAt).toBeNull();
  });
});

describe('the register', () => {
  async function groupWithMembers() {
    const setup = await studio();
    const groupId = groupSaveResultSchema.parse((await createGroup(setup)).body).group.id;

    for (const student of [setup.first, setup.second]) {
      const applied = await apply(groupId, student.id);
      await approve(setup, groupId, applied.body.id);
    }

    const meeting = (await lessonsOf(setup.teacher.id, 'TEACHER')).find(isGroupLesson);
    if (!meeting) {
      throw new Error('The group should have meetings');
    }

    return { setup, groupId, lessonId: meeting.id };
  }

  it('lists every active member, marked or not', async () => {
    const { setup, lessonId } = await groupWithMembers();

    const response = await request(app)
      .get(`/me/lessons/${lessonId}/attendance`)
      .set('authorization', `Bearer ${setup.teacherToken}`);

    expect(response.status).toBe(200);
    const register = lessonAttendanceSchema.parse(response.body);
    expect(register.entries).toHaveLength(2);
    expect(register.entries.every((entry) => entry.status === null)).toBe(true);
  });

  it('records the marks and replaces them on the next save', async () => {
    const { setup, lessonId } = await groupWithMembers();

    const saved = await request(app)
      .put(`/me/lessons/${lessonId}/attendance`)
      .set('authorization', `Bearer ${setup.teacherToken}`)
      .send({
        entries: [
          { studentId: setup.first.id, status: 'PRESENT' },
          { studentId: setup.second.id, status: 'ABSENT' },
        ],
      });

    expect(saved.status).toBe(200);
    const register = lessonAttendanceSchema.parse(saved.body);
    expect(markFor(register.entries, setup.first.id)).toBe('PRESENT');
    expect(markFor(register.entries, setup.second.id)).toBe('ABSENT');

    const corrected = await request(app)
      .put(`/me/lessons/${lessonId}/attendance`)
      .set('authorization', `Bearer ${setup.teacherToken}`)
      .send({ entries: [{ studentId: setup.second.id, status: 'EXCUSED' }] });

    const after = lessonAttendanceSchema.parse(corrected.body);
    // Unticking a name removes the mark rather than leaving yesterday's answer.
    expect(markFor(after.entries, setup.first.id)).toBeNull();
    expect(markFor(after.entries, setup.second.id)).toBe('EXCUSED');
  });

  it('refuses a mark for somebody who is not in the group', async () => {
    const { setup, lessonId } = await groupWithMembers();
    const stranger = await createUser(prisma);

    const response = await request(app)
      .put(`/me/lessons/${lessonId}/attendance`)
      .set('authorization', `Bearer ${setup.teacherToken}`)
      .send({ entries: [{ studentId: stranger.id, status: 'PRESENT' }] });

    expect(response.status).toBe(400);
  });

  it('refuses another teacher`s register', async () => {
    const { setup, lessonId } = await groupWithMembers();
    const other = await createTeacher(prisma, { locationIds: [setup.location.id] });

    const response = await request(app)
      .get(`/me/lessons/${lessonId}/attendance`)
      .set('authorization', `Bearer ${await tokenFor(other.id, 'TEACHER')}`);

    expect(response.status).toBe(403);
  });

  it('has no room for a no-show on a whole group', async () => {
    const { setup, lessonId } = await groupWithMembers();
    clock = kyiv('2026-09-02', '11:30');

    const response = await request(app)
      .post(`/lessons/${lessonId}/no-show`)
      .set('authorization', `Bearer ${setup.teacherToken}`);

    expect(response.status).toBe(422);
  });

  it('lets the teacher close the meeting out once it has begun', async () => {
    const { setup, lessonId } = await groupWithMembers();
    clock = kyiv('2026-09-02', '11:30');

    const response = await request(app)
      .post(`/lessons/${lessonId}/complete`)
      .set('authorization', `Bearer ${setup.teacherToken}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('COMPLETED');
  });
});

describe('GET /groups', () => {
  it('shows only the groups that are taking applications', async () => {
    const setup = await studio();
    await createGroup(setup, { name: 'Відкрита' });
    await createGroup(setup, {
      name: 'Закрита',
      isOpenForEnrollment: false,
      schedule: [{ weekday: 3, startTime: '13:00' }],
    });

    const response = await request(app).get('/groups');

    const names = (response.body as { name: string }[]).map((group) => group.name);
    expect(names).toEqual(['Відкрита']);
  });
});

function isGroupLesson(lesson: Lesson): boolean {
  return lesson.group !== null;
}

function markFor(
  entries: { student: { id: string }; status: string | null }[],
  studentId: string,
): string | null {
  return entries.find((entry) => entry.student.id === studentId)?.status ?? null;
}

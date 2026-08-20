import { fromZonedTime, lessonSchema, parseLocalDate, parseTimeOfDay } from '@palitra/shared';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../http/app';
import { createAccessTokenService } from '../../lib/access-token';
import { createMemoryMailer } from '../../lib/mailer';
import { createAvailabilityService } from '../availability/availability.service';
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
import { createBookingRouter } from './booking.router';
import { createBookingService } from './booking.service';

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

/** A teacher working Wednesdays 10:00-14:00, a 60-minute plan and a student. */
async function studio() {
  const location = await createLocation(prisma);
  const direction = await createDirection(prisma);
  const teacher = await createTeacher(prisma, { locationIds: [location.id] });
  const plan = await createPricePlan(prisma, {
    directionId: direction.id,
    durationMinutes: 60,
  });
  await createRule(prisma, {
    teacherId: teacher.id,
    locationId: location.id,
    on: '2026-09-02',
    from: '10:00',
    to: '14:00',
  });
  const student = await createUser(prisma);

  return { location, teacher, plan, student };
}

function bookingBody(
  setup: Awaited<ReturnType<typeof studio>>,
  overrides: Record<string, unknown> = {},
) {
  return {
    teacherId: setup.teacher.id,
    locationId: setup.location.id,
    pricePlanId: setup.plan.id,
    startsAt: kyiv('2026-09-02', '10:00').toISOString(),
    kind: 'TRIAL',
    ...overrides,
  };
}

function book(
  setup: Awaited<ReturnType<typeof studio>>,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  return request(app)
    .post('/bookings')
    .set('authorization', `Bearer ${token}`)
    .send(bookingBody(setup, overrides));
}

describe('POST /bookings', () => {
  it('books a free slot and tells the teacher', async () => {
    const setup = await studio();

    const response = await book(setup, await tokenFor(setup.student.id));

    expect(response.status).toBe(201);
    const lesson = lessonSchema.parse(response.body);
    expect(lesson.status).toBe('PENDING');
    expect(lesson.kind).toBe('TRIAL');
    expect(lesson.durationMinutes).toBe(60);
    expect(lesson.endsAt).toBe(kyiv('2026-09-02', '11:00').toISOString());
    expect(lesson.teacher.id).toBe(setup.teacher.id);
    expect(mailer.sent.at(-1)?.to).toBe(setup.teacher.email);
  });

  it('takes the duration from the plan, not from the request', async () => {
    const setup = await studio();
    const direction = await createDirection(prisma);
    const short = await createPricePlan(prisma, {
      directionId: direction.id,
      durationMinutes: 30,
    });

    const response = await book(setup, await tokenFor(setup.student.id), {
      pricePlanId: short.id,
      durationMinutes: 90,
    });

    expect(lessonSchema.parse(response.body).durationMinutes).toBe(30);
  });

  it('takes the slot out of circulation', async () => {
    const setup = await studio();
    await book(setup, await tokenFor(setup.student.id));

    const slots = await availability.getSlots(setup.teacher.id, {
      from: '2026-09-02',
      to: '2026-09-02',
      duration: 60,
    });

    // 10:00 through 10:45 are all covered by the booked hour; the day now
    // starts at 11:00.
    expect(slots.slots[0]?.startsAt).toBe(kyiv('2026-09-02', '11:00').toISOString());
  });

  it('refuses an hour that is not on offer', async () => {
    const setup = await studio();

    const response = await book(setup, await tokenFor(setup.student.id), {
      startsAt: kyiv('2026-09-02', '20:00').toISOString(),
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SLOT_TAKEN');
  });

  it('refuses a start that is not on the fifteen-minute grid', async () => {
    const setup = await studio();

    const response = await book(setup, await tokenFor(setup.student.id), {
      startsAt: kyiv('2026-09-02', '10:07').toISOString(),
    });

    expect(response.status).toBe(409);
  });

  it('refuses a slot at an address the teacher does not work at that day', async () => {
    const setup = await studio();
    const elsewhere = await createLocation(prisma);

    const response = await book(setup, await tokenFor(setup.student.id), {
      locationId: elsewhere.id,
    });

    expect(response.status).toBe(409);
  });

  it('refuses a date past the four-week horizon', async () => {
    const setup = await studio();

    const response = await book(setup, await tokenFor(setup.student.id), {
      startsAt: kyiv('2026-11-04', '10:00').toISOString(),
    });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('OUTSIDE_BOOKING_HORIZON');
  });

  it('refuses a time that has already passed', async () => {
    const setup = await studio();

    const response = await book(setup, await tokenFor(setup.student.id), {
      startsAt: kyiv('2026-08-26', '10:00').toISOString(),
    });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('OUTSIDE_BOOKING_HORIZON');
  });

  it('gives a student exactly one free trial', async () => {
    const setup = await studio();
    const token = await tokenFor(setup.student.id);

    await book(setup, token);
    const second = await book(setup, token, {
      startsAt: kyiv('2026-09-09', '10:00').toISOString(),
    });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('TRIAL_ALREADY_USED');
  });

  it('returns the right to a trial when the first one is cancelled', async () => {
    const setup = await studio();
    const token = await tokenFor(setup.student.id);
    const first = await book(setup, token);

    await request(app)
      .post(`/lessons/${first.body.id}/cancel`)
      .set('authorization', `Bearer ${token}`)
      .send({});

    const second = await book(setup, token);

    // An accidental cancellation must not cost someone their only free lesson.
    expect(second.status).toBe(201);
  });

  it('lets an unverified student book once and then asks for the address', async () => {
    const setup = await studio();
    const newcomer = await createUser(prisma, { emailVerified: false });
    const token = await tokenFor(newcomer.id);

    const first = await book(setup, token);
    expect(first.status).toBe(201);

    const second = await book(setup, token, {
      kind: 'SINGLE',
      startsAt: kyiv('2026-09-09', '10:00').toISOString(),
    });

    expect(second.status).toBe(403);
    expect(second.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('refuses a group tariff for now', async () => {
    const setup = await studio();
    const direction = await createDirection(prisma);
    const group = await createPricePlan(prisma, {
      directionId: direction.id,
      format: 'GROUP',
    });

    const response = await book(setup, await tokenFor(setup.student.id), {
      pricePlanId: group.id,
    });

    expect(response.status).toBe(400);
  });

  it('refuses a tariff that is no longer sold', async () => {
    const setup = await studio();
    const direction = await createDirection(prisma);
    const retired = await createPricePlan(prisma, {
      directionId: direction.id,
      isActive: false,
    });

    const response = await book(setup, await tokenFor(setup.student.id), {
      pricePlanId: retired.id,
    });

    expect(response.status).toBe(404);
  });

  it('needs a session', async () => {
    const setup = await studio();

    const response = await request(app).post('/bookings').send(bookingBody(setup));

    expect(response.status).toBe(401);
  });

  /**
   * The test the whole exclusion constraint exists for. Without it the
   * constraint could quietly stop working - a dropped extension, a rewritten
   * migration - and we would find out from two families arriving for the same
   * hour.
   */
  it('gives one of two simultaneous bookings the slot and the other a 409', async () => {
    const setup = await studio();
    const rival = await createUser(prisma);
    const [first, second] = await Promise.all([
      book(setup, await tokenFor(setup.student.id)),
      book(setup, await tokenFor(rival.id)),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toStrictEqual([201, 409]);

    const loser = first.status === 409 ? first : second;
    expect(loser.body.code).toBe('SLOT_TAKEN');
    await expect(prisma.lesson.count()).resolves.toBe(1);
  });

  it('has the database itself refuse an overlapping lesson', async () => {
    // Straight through Prisma, past every check in the service: this asserts
    // the constraint exists and is armed, not that the service remembered to
    // look. The race test above is only meaningful while this passes.
    const setup = await studio();
    const row = {
      teacherId: setup.teacher.id,
      studentId: setup.student.id,
      locationId: setup.location.id,
      durationMinutes: 60,
      kind: 'SINGLE' as const,
      status: 'CONFIRMED' as const,
    };

    await prisma.lesson.create({
      data: { ...row, startsAt: kyiv('2026-09-02', '10:00'), endsAt: kyiv('2026-09-02', '11:00') },
    });

    await expect(
      prisma.lesson.create({
        data: {
          ...row,
          // Overlaps the second half of the first lesson.
          startsAt: kyiv('2026-09-02', '10:30'),
          endsAt: kyiv('2026-09-02', '11:30'),
        },
      }),
    ).rejects.toThrow(/lesson_no_overlap|23P01/);

    // Touching is fine: a lesson may start the moment another ends.
    await expect(
      prisma.lesson.create({
        data: {
          ...row,
          startsAt: kyiv('2026-09-02', '11:00'),
          endsAt: kyiv('2026-09-02', '12:00'),
        },
      }),
    ).resolves.toBeDefined();
  });

  it('lets the hour be booked again after the first lesson is cancelled', async () => {
    const setup = await studio();
    const token = await tokenFor(setup.student.id);
    const first = await book(setup, token);

    await request(app)
      .post(`/lessons/${first.body.id}/cancel`)
      .set('authorization', `Bearer ${token}`)
      .send({});

    const rival = await createUser(prisma);
    const second = await book(setup, await tokenFor(rival.id));

    expect(second.status).toBe(201);
  });
});

describe('the lesson lifecycle', () => {
  async function pendingLesson() {
    const setup = await studio();
    const studentToken = await tokenFor(setup.student.id);
    const teacherToken = await tokenFor(setup.teacher.id, 'TEACHER');
    const created = await book(setup, studentToken);

    return { setup, studentToken, teacherToken, lessonId: created.body.id as string };
  }

  it('runs booking -> confirmation -> completed', async () => {
    const { teacherToken, lessonId, setup } = await pendingLesson();

    const confirmed = await request(app)
      .post(`/lessons/${lessonId}/confirm`)
      .set('authorization', `Bearer ${teacherToken}`);

    expect(confirmed.status).toBe(200);
    expect(lessonSchema.parse(confirmed.body).status).toBe('CONFIRMED');
    expect(mailer.sent.at(-1)?.to).toBe(setup.student.email);

    // The teacher marks the lesson once it has begun.
    clock = kyiv('2026-09-02', '11:05');

    const completed = await request(app)
      .post(`/lessons/${lessonId}/complete`)
      .set('authorization', `Bearer ${teacherToken}`);

    expect(completed.status).toBe(200);
    expect(lessonSchema.parse(completed.body).status).toBe('COMPLETED');
  });

  it('records a no-show', async () => {
    const { teacherToken, lessonId } = await pendingLesson();
    await request(app)
      .post(`/lessons/${lessonId}/confirm`)
      .set('authorization', `Bearer ${teacherToken}`);
    clock = kyiv('2026-09-02', '11:05');

    const response = await request(app)
      .post(`/lessons/${lessonId}/no-show`)
      .set('authorization', `Bearer ${teacherToken}`);

    expect(lessonSchema.parse(response.body).status).toBe('NO_SHOW');
  });

  it('will not mark a lesson that has not started', async () => {
    const { teacherToken, lessonId } = await pendingLesson();
    await request(app)
      .post(`/lessons/${lessonId}/confirm`)
      .set('authorization', `Bearer ${teacherToken}`);

    const response = await request(app)
      .post(`/lessons/${lessonId}/complete`)
      .set('authorization', `Bearer ${teacherToken}`);

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('INVALID_LESSON_STATUS');
  });

  it('will not complete a lesson nobody confirmed', async () => {
    const { teacherToken, lessonId } = await pendingLesson();
    clock = kyiv('2026-09-02', '11:05');

    const response = await request(app)
      .post(`/lessons/${lessonId}/complete`)
      .set('authorization', `Bearer ${teacherToken}`);

    expect(response.status).toBe(422);
  });

  it('will not confirm the same lesson twice', async () => {
    const { teacherToken, lessonId } = await pendingLesson();
    await request(app)
      .post(`/lessons/${lessonId}/confirm`)
      .set('authorization', `Bearer ${teacherToken}`);

    const again = await request(app)
      .post(`/lessons/${lessonId}/confirm`)
      .set('authorization', `Bearer ${teacherToken}`);

    expect(again.status).toBe(422);
  });

  it('refuses to let another teacher confirm the lesson', async () => {
    const { lessonId } = await pendingLesson();
    const intruder = await createTeacher(prisma);

    const response = await request(app)
      .post(`/lessons/${lessonId}/confirm`)
      .set('authorization', `Bearer ${await tokenFor(intruder.id, 'TEACHER')}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('NOT_TEACHER_OWNED');
  });

  it('refuses to let the student confirm their own lesson', async () => {
    const { studentToken, lessonId } = await pendingLesson();

    const response = await request(app)
      .post(`/lessons/${lessonId}/confirm`)
      .set('authorization', `Bearer ${studentToken}`);

    expect(response.status).toBe(403);
  });

  it('lets an admin confirm anybody`s lesson', async () => {
    const { lessonId } = await pendingLesson();
    const admin = await createUser(prisma, { role: 'ADMIN' });

    const response = await request(app)
      .post(`/lessons/${lessonId}/confirm`)
      .set('authorization', `Bearer ${await tokenFor(admin.id, 'ADMIN')}`);

    expect(response.status).toBe(200);
  });
});

describe('cancellation', () => {
  async function confirmedLesson(startsAt = kyiv('2026-09-02', '10:00')) {
    const setup = await studio();
    const studentToken = await tokenFor(setup.student.id);
    const teacherToken = await tokenFor(setup.teacher.id, 'TEACHER');
    const created = await book(setup, studentToken, { startsAt: startsAt.toISOString() });
    await request(app)
      .post(`/lessons/${created.body.id}/confirm`)
      .set('authorization', `Bearer ${teacherToken}`);

    return { setup, studentToken, teacherToken, lessonId: created.body.id as string };
  }

  it('lets a student cancel more than a day ahead', async () => {
    const { studentToken, lessonId, setup } = await confirmedLesson();

    const response = await request(app)
      .post(`/lessons/${lessonId}/cancel`)
      .set('authorization', `Bearer ${studentToken}`)
      .send({ reason: 'Захворів' });

    expect(response.status).toBe(200);
    const lesson = lessonSchema.parse(response.body);
    expect(lesson.status).toBe('CANCELLED');
    expect(lesson.cancelReason).toBe('Захворів');
    // The other side is told; the person who pressed the button already knows.
    expect(mailer.sent.at(-1)?.to).toBe(setup.teacher.email);
  });

  it('stops a student cancelling inside the last day', async () => {
    const { studentToken, lessonId } = await confirmedLesson();
    // Twelve hours before the lesson.
    clock = kyiv('2026-09-01', '22:00');

    const response = await request(app)
      .post(`/lessons/${lessonId}/cancel`)
      .set('authorization', `Bearer ${studentToken}`)
      .send({});

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('TOO_LATE_TO_CANCEL');
  });

  it('lets the teacher cancel at any time', async () => {
    const { teacherToken, lessonId } = await confirmedLesson();
    clock = kyiv('2026-09-02', '09:30');

    const response = await request(app)
      .post(`/lessons/${lessonId}/cancel`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ reason: 'Концерт студії' });

    expect(response.status).toBe(200);
    expect(lessonSchema.parse(response.body).status).toBe('CANCELLED');
  });

  it('refuses a stranger', async () => {
    const { lessonId } = await confirmedLesson();
    const stranger = await createUser(prisma);

    const response = await request(app)
      .post(`/lessons/${lessonId}/cancel`)
      .set('authorization', `Bearer ${await tokenFor(stranger.id)}`)
      .send({});

    expect(response.status).toBe(403);
  });

  it('will not cancel a lesson twice', async () => {
    const { studentToken, lessonId } = await confirmedLesson();
    await request(app)
      .post(`/lessons/${lessonId}/cancel`)
      .set('authorization', `Bearer ${studentToken}`)
      .send({});

    const again = await request(app)
      .post(`/lessons/${lessonId}/cancel`)
      .set('authorization', `Bearer ${studentToken}`)
      .send({});

    expect(again.status).toBe(422);
  });
});

describe('GET /me/lessons', () => {
  it('shows a student their lessons and a teacher theirs', async () => {
    const setup = await studio();
    const studentToken = await tokenFor(setup.student.id);
    await book(setup, studentToken);

    const asStudent = await request(app)
      .get('/me/lessons')
      .set('authorization', `Bearer ${studentToken}`);

    const asTeacher = await request(app)
      .get('/me/lessons')
      .set('authorization', `Bearer ${await tokenFor(setup.teacher.id, 'TEACHER')}`);

    expect(asStudent.body).toHaveLength(1);
    expect(asTeacher.body).toHaveLength(1);
    expect(asTeacher.body[0].student.phone).toBe(setup.student.phone);
  });

  it('shows nothing to someone who is not a party to any lesson', async () => {
    const setup = await studio();
    await book(setup, await tokenFor(setup.student.id));
    const stranger = await createUser(prisma);

    const response = await request(app)
      .get('/me/lessons')
      .set('authorization', `Bearer ${await tokenFor(stranger.id)}`);

    expect(response.body).toStrictEqual([]);
  });
});

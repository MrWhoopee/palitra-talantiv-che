import {
  fromZonedTime,
  parseLocalDate,
  parseTimeOfDay,
  subscriptionListSchema,
  subscriptionSchema,
} from '@palitra/shared';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../http/app';
import { createAccessTokenService } from '../../lib/access-token';
import { createMemoryMailer } from '../../lib/mailer';
import { createAvailabilityService } from '../availability/availability.service';
import { createBookingRouter } from '../booking/booking.router';
import { createBookingService } from '../booking/booking.service';
import { createTestPrisma, resetDatabase } from '../../test/database';
import {
  createDirection,
  createLocation,
  createPricePlan,
  createRule,
  createSubscription,
  createTeacher,
  createUser,
} from '../../test/fixtures';
import { createSubscriptionsRouter } from './subscriptions.router';
import { createSubscriptionService } from './subscriptions.service';

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
    createSubscriptionsRouter({ subscriptions, accessTokens }),
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

/** A teacher working Wednesdays 10:00-14:00, an eight-lesson plan and a student. */
async function studio() {
  const location = await createLocation(prisma);
  const direction = await createDirection(prisma);
  const teacher = await createTeacher(prisma, { locationIds: [location.id] });
  const plan = await createPricePlan(prisma, {
    directionId: direction.id,
    durationMinutes: 60,
    lessonsCount: 8,
    priceUah: 3000,
  });
  await createRule(prisma, {
    teacherId: teacher.id,
    locationId: location.id,
    on: '2026-09-02',
    from: '10:00',
    to: '14:00',
  });
  const student = await createUser(prisma);
  const admin = await createUser(prisma, { role: 'ADMIN' });

  return { location, direction, teacher, plan, student, admin };
}

type Studio = Awaited<ReturnType<typeof studio>>;

function bookFrom(
  setup: Studio,
  subscriptionId: string,
  token: string,
  time = '10:00',
  day = '2026-09-02',
) {
  return request(app)
    .post('/bookings')
    .set('authorization', `Bearer ${token}`)
    .send({
      teacherId: setup.teacher.id,
      locationId: setup.location.id,
      subscriptionId,
      startsAt: kyiv(day, time).toISOString(),
      kind: 'SUBSCRIPTION',
    });
}

async function readSubscription(id: string, token: string) {
  const response = await request(app)
    .get('/me/subscriptions')
    .set('authorization', `Bearer ${token}`);

  return subscriptionListSchema.parse(response.body).find((row) => row.id === id);
}

describe('POST /subscriptions', () => {
  it('takes the lesson count and the price from the plan', async () => {
    const setup = await studio();

    const response = await request(app)
      .post('/subscriptions')
      .set('authorization', `Bearer ${await tokenFor(setup.admin.id, 'ADMIN')}`)
      .send({
        studentId: setup.student.id,
        teacherId: setup.teacher.id,
        pricePlanId: setup.plan.id,
        validFrom: '2026-09-01',
        validTo: '2026-10-31',
        paid: true,
      });

    expect(response.status).toBe(201);
    const subscription = subscriptionSchema.parse(response.body);
    expect(subscription.lessonsTotal).toBe(8);
    expect(subscription.priceUah).toBe(3000);
    expect(subscription.lessonsLeft).toBe(8);
    expect(subscription.paidAt).not.toBeNull();
  });

  it('leaves a package unpaid until the studio says otherwise', async () => {
    const setup = await studio();
    const adminToken = await tokenFor(setup.admin.id, 'ADMIN');

    const created = await request(app)
      .post('/subscriptions')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        studentId: setup.student.id,
        teacherId: setup.teacher.id,
        pricePlanId: setup.plan.id,
        validFrom: '2026-09-01',
        validTo: '2026-10-31',
      });

    expect(subscriptionSchema.parse(created.body).paidAt).toBeNull();

    const paid = await request(app)
      .post(`/subscriptions/${created.body.id}/paid`)
      .set('authorization', `Bearer ${adminToken}`);

    expect(subscriptionSchema.parse(paid.body).paidAt).not.toBeNull();
  });

  it('refuses a group tariff', async () => {
    const setup = await studio();
    const groupPlan = await createPricePlan(prisma, {
      directionId: setup.direction.id,
      format: 'GROUP',
      lessonsCount: 8,
    });

    const response = await request(app)
      .post('/subscriptions')
      .set('authorization', `Bearer ${await tokenFor(setup.admin.id, 'ADMIN')}`)
      .send({
        studentId: setup.student.id,
        teacherId: setup.teacher.id,
        pricePlanId: groupPlan.id,
        validFrom: '2026-09-01',
        validTo: '2026-10-31',
      });

    expect(response.status).toBe(400);
  });

  it('is not something a teacher may do', async () => {
    const setup = await studio();

    const response = await request(app)
      .post('/subscriptions')
      .set('authorization', `Bearer ${await tokenFor(setup.teacher.id, 'TEACHER')}`)
      .send({
        studentId: setup.student.id,
        teacherId: setup.teacher.id,
        pricePlanId: setup.plan.id,
        validFrom: '2026-09-01',
        validTo: '2026-10-31',
      });

    expect(response.status).toBe(403);
  });
});

describe('GET /me/subscriptions', () => {
  it('shows a student their own packages and a teacher their students`', async () => {
    const setup = await studio();
    const other = await createUser(prisma);
    const mine = await createSubscription(prisma, {
      studentId: setup.student.id,
      teacherId: setup.teacher.id,
      pricePlanId: setup.plan.id,
    });

    const asStudent = await readSubscription(mine.id, await tokenFor(setup.student.id));
    expect(asStudent?.id).toBe(mine.id);

    const asTeacher = await readSubscription(mine.id, await tokenFor(setup.teacher.id, 'TEACHER'));
    expect(asTeacher?.id).toBe(mine.id);

    const asStranger = await readSubscription(mine.id, await tokenFor(other.id));
    expect(asStranger).toBeUndefined();
  });
});

describe('booking against a package', () => {
  it('links the lesson to the package and holds one of its lessons', async () => {
    const setup = await studio();
    const studentToken = await tokenFor(setup.student.id);
    const subscription = await createSubscription(prisma, {
      studentId: setup.student.id,
      teacherId: setup.teacher.id,
      pricePlanId: setup.plan.id,
      lessonsTotal: 8,
    });

    const response = await bookFrom(setup, subscription.id, studentToken);

    expect(response.status).toBe(201);
    expect(response.body.kind).toBe('SUBSCRIPTION');
    expect(response.body.subscriptionId).toBe(subscription.id);
    // The duration came from the plan the package was sold against.
    expect(response.body.durationMinutes).toBe(60);

    const after = await readSubscription(subscription.id, studentToken);
    expect(after?.lessonsUsed).toBe(0);
    expect(after?.lessonsReserved).toBe(1);
    expect(after?.lessonsLeft).toBe(7);
  });

  it('refuses once every lesson in the package is spoken for', async () => {
    const setup = await studio();
    const studentToken = await tokenFor(setup.student.id);
    const subscription = await createSubscription(prisma, {
      studentId: setup.student.id,
      teacherId: setup.teacher.id,
      pricePlanId: setup.plan.id,
      lessonsTotal: 1,
    });

    expect((await bookFrom(setup, subscription.id, studentToken, '10:00')).status).toBe(201);

    const second = await bookFrom(setup, subscription.id, studentToken, '11:00');
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('SUBSCRIPTION_EXHAUSTED');
  });

  it('counts a package that has already been drawn down', async () => {
    const setup = await studio();
    const studentToken = await tokenFor(setup.student.id);
    const subscription = await createSubscription(prisma, {
      studentId: setup.student.id,
      teacherId: setup.teacher.id,
      pricePlanId: setup.plan.id,
      lessonsTotal: 4,
      lessonsUsed: 4,
    });

    const response = await bookFrom(setup, subscription.id, studentToken);
    expect(response.body.code).toBe('SUBSCRIPTION_EXHAUSTED');
  });

  it('gives one of two simultaneous bookings the last lesson and the other a 409', async () => {
    // Two tabs, one lesson left, different hours - so nothing but the package
    // itself can decide the outcome. Without the row lock in `reserve` both
    // read "one left" and both write.
    const setup = await studio();
    const studentToken = await tokenFor(setup.student.id);
    const subscription = await createSubscription(prisma, {
      studentId: setup.student.id,
      teacherId: setup.teacher.id,
      pricePlanId: setup.plan.id,
      lessonsTotal: 1,
    });

    const [first, second] = await Promise.all([
      bookFrom(setup, subscription.id, studentToken, '10:00'),
      bookFrom(setup, subscription.id, studentToken, '12:00'),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const after = await readSubscription(subscription.id, studentToken);
    expect(after?.lessonsReserved).toBe(1);
  });

  it('refuses somebody else`s package', async () => {
    const setup = await studio();
    const other = await createUser(prisma);
    const subscription = await createSubscription(prisma, {
      studentId: other.id,
      teacherId: setup.teacher.id,
      pricePlanId: setup.plan.id,
    });

    const response = await bookFrom(setup, subscription.id, await tokenFor(setup.student.id));
    expect(response.status).toBe(403);
  });

  it('refuses a package bought from another teacher', async () => {
    const setup = await studio();
    const otherTeacher = await createTeacher(prisma, { locationIds: [setup.location.id] });
    const subscription = await createSubscription(prisma, {
      studentId: setup.student.id,
      teacherId: otherTeacher.id,
      pricePlanId: setup.plan.id,
    });

    const response = await bookFrom(setup, subscription.id, await tokenFor(setup.student.id));
    expect(response.status).toBe(400);
  });

  it('refuses a lesson outside the package`s dates', async () => {
    const setup = await studio();
    const subscription = await createSubscription(prisma, {
      studentId: setup.student.id,
      teacherId: setup.teacher.id,
      pricePlanId: setup.plan.id,
      validFrom: '2026-08-01',
      validTo: '2026-09-01',
    });

    const response = await bookFrom(setup, subscription.id, await tokenFor(setup.student.id));
    expect(response.body.code).toBe('NO_ACTIVE_SUBSCRIPTION');
  });

  it('refuses a cancelled package', async () => {
    const setup = await studio();
    const subscription = await createSubscription(prisma, {
      studentId: setup.student.id,
      teacherId: setup.teacher.id,
      pricePlanId: setup.plan.id,
      status: 'CANCELLED',
    });

    const response = await bookFrom(setup, subscription.id, await tokenFor(setup.student.id));
    expect(response.body.code).toBe('NO_ACTIVE_SUBSCRIPTION');
  });
});

describe('drawing a lesson from the package', () => {
  async function booked(lessonsTotal = 8) {
    const setup = await studio();
    const studentToken = await tokenFor(setup.student.id);
    const teacherToken = await tokenFor(setup.teacher.id, 'TEACHER');
    const subscription = await createSubscription(prisma, {
      studentId: setup.student.id,
      teacherId: setup.teacher.id,
      pricePlanId: setup.plan.id,
      lessonsTotal,
    });

    const created = await bookFrom(setup, subscription.id, studentToken);
    await request(app)
      .post(`/lessons/${created.body.id}/confirm`)
      .set('authorization', `Bearer ${teacherToken}`);

    return {
      setup,
      studentToken,
      teacherToken,
      subscriptionId: subscription.id as string,
      lessonId: created.body.id as string,
    };
  }

  it('draws one lesson when the teacher marks it done', async () => {
    const { lessonId, teacherToken, studentToken, subscriptionId } = await booked();
    clock = kyiv('2026-09-02', '11:05');

    const response = await request(app)
      .post(`/lessons/${lessonId}/complete`)
      .set('authorization', `Bearer ${teacherToken}`);

    expect(response.status).toBe(200);
    const after = await readSubscription(subscriptionId, studentToken);
    expect(after?.lessonsUsed).toBe(1);
    expect(after?.lessonsReserved).toBe(0);
    expect(after?.lessonsLeft).toBe(7);
  });

  it('draws one lesson for a no-show as well', async () => {
    const { lessonId, teacherToken, studentToken, subscriptionId } = await booked();
    clock = kyiv('2026-09-02', '11:05');

    await request(app)
      .post(`/lessons/${lessonId}/no-show`)
      .set('authorization', `Bearer ${teacherToken}`);

    expect((await readSubscription(subscriptionId, studentToken))?.lessonsUsed).toBe(1);
  });

  it('draws nothing when the lesson is called off in good time', async () => {
    const { lessonId, studentToken, subscriptionId } = await booked();

    await request(app)
      .post(`/lessons/${lessonId}/cancel`)
      .set('authorization', `Bearer ${studentToken}`)
      .send({});

    const after = await readSubscription(subscriptionId, studentToken);
    expect(after?.lessonsUsed).toBe(0);
    expect(after?.lessonsLeft).toBe(8);
  });

  it('charges a lesson called off inside the last day', async () => {
    const { lessonId, teacherToken, studentToken, subscriptionId } = await booked();
    // Twelve hours before the lesson: too late for the student, so it goes
    // through the teacher - and it still costs a lesson.
    clock = kyiv('2026-09-01', '22:00');

    await request(app)
      .post(`/lessons/${lessonId}/cancel`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ reason: 'Не прийшли' });

    expect((await readSubscription(subscriptionId, studentToken))?.lessonsUsed).toBe(1);
  });

  it('lets the teacher call one off without charging it', async () => {
    const { lessonId, teacherToken, studentToken, subscriptionId } = await booked();
    clock = kyiv('2026-09-01', '22:00');

    await request(app)
      .post(`/lessons/${lessonId}/cancel`)
      .set('authorization', `Bearer ${teacherToken}`)
      .send({ reason: 'Захворів викладач', waiveCharge: true });

    expect((await readSubscription(subscriptionId, studentToken))?.lessonsUsed).toBe(0);
  });

  it('never draws more lessons than the package holds', async () => {
    // The guard inside the update and the check constraint under it both say
    // the same thing; this is the test that would notice if either went away.
    const { lessonId, teacherToken, studentToken, subscriptionId } = await booked(1);
    clock = kyiv('2026-09-02', '11:05');

    const first = await request(app)
      .post(`/lessons/${lessonId}/complete`)
      .set('authorization', `Bearer ${teacherToken}`);
    const second = await request(app)
      .post(`/lessons/${lessonId}/complete`)
      .set('authorization', `Bearer ${teacherToken}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(422);
    expect((await readSubscription(subscriptionId, studentToken))?.lessonsUsed).toBe(1);
  });
});

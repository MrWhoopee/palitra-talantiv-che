import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../http/app';
import { createAccessTokenService } from '../../lib/access-token';
import type { Mailer } from '../../lib/mailer';
import { createTestPrisma, resetDatabase } from '../../test/database';
import {
  createDirection,
  createLocation,
  createPricePlan,
  createRule,
  createTeacher,
  createUser,
} from '../../test/fixtures';
import { createAvailabilityService } from '../availability/availability.service';
import { createBookingService } from '../booking/booking.service';
import { createGroupsService } from '../groups/groups.service';
import { createStudentsService } from '../students/students.service';
import { createSubscriptionService } from '../subscriptions/subscriptions.service';
import { createAdminRouter } from './admin.router';
import { createOperationsAdminRouter } from './operations.admin.router';

const prisma = createTestPrisma();
const accessTokens = createAccessTokenService({ secret: 'test-secret'.repeat(4), ttlSeconds: 900 });

const sent: unknown[] = [];
const mailer: Mailer = {
  async send(mail) {
    sent.push(mail);
  },
};

const availability = createAvailabilityService({ prisma });
const subscriptions = createSubscriptionService({ prisma });
const booking = createBookingService({
  prisma,
  availability,
  subscriptions,
  mailer,
  webOrigin: 'http://localhost:3000',
});
const groups = createGroupsService({ prisma });
const students = createStudentsService({ prisma });

const app: Express = createApp({
  checkDatabase: async () => true,
  routers: [
    createAdminRouter({
      accessTokens,
      routers: [createOperationsAdminRouter({ booking, groups, students, subscriptions })],
    }),
  ],
});

let admin: string;
let adminId: string;

beforeEach(async () => {
  await resetDatabase(prisma);
  sent.length = 0;
  adminId = (await createUser(prisma, { role: 'ADMIN', email: 'admin@example.com' })).id;
  admin = `Bearer ${await accessTokens.sign({ userId: adminId, role: 'ADMIN' })}`;
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** A teacher who works Mondays, with somewhere to work and something to teach. */
async function studioWithATeacher() {
  const location = await createLocation(prisma);
  const direction = await createDirection(prisma);
  const teacher = await createTeacher(prisma, {
    firstName: 'Ірина',
    lastName: 'Шевченко',
    locationIds: [location.id],
    directionIds: [direction.id],
  });
  const plan = await createPricePlan(prisma, { directionId: direction.id, durationMinutes: 60 });

  // 2026-09-07 is a Monday.
  await createRule(prisma, {
    teacherId: teacher.id,
    locationId: location.id,
    on: '2026-09-07',
    from: '10:00',
    to: '18:00',
  });

  return { location, direction, teacher, plan };
}

describe('GET /admin/lessons', () => {
  it('reads the studio, not the caller: a lesson between two other people', async () => {
    const { location, teacher, plan } = await studioWithATeacher();
    const student = await createUser(prisma, { firstName: 'Марта', lastName: 'Гнатюк' });

    await prisma.lesson.create({
      data: {
        teacherId: teacher.id,
        studentId: student.id,
        locationId: location.id,
        pricePlanId: plan.id,
        startsAt: new Date('2026-09-07T08:00:00Z'),
        endsAt: new Date('2026-09-07T09:00:00Z'),
        durationMinutes: 60,
        kind: 'SINGLE',
        status: 'CONFIRMED',
      },
    });

    const response = await request(app)
      .get('/admin/lessons?from=2026-09-07&to=2026-09-07')
      .set('Authorization', admin);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].student.firstName).toBe('Марта');
  });

  it('takes the day to end at Kyiv midnight, not at UTC midnight', async () => {
    const { location, teacher, plan } = await studioWithATeacher();
    const student = await createUser(prisma);

    // 21:30 in Kyiv on 7 September is 18:30 UTC - still the 7th either way.
    // 23:30 in Kyiv is 20:30 UTC, and on a range built in UTC the evening
    // lesson would fall outside the day the studio asked for.
    for (const startsAt of ['2026-09-07T18:30:00Z', '2026-09-07T20:30:00Z']) {
      await prisma.lesson.create({
        data: {
          teacherId: teacher.id,
          studentId: student.id,
          locationId: location.id,
          pricePlanId: plan.id,
          startsAt: new Date(startsAt),
          endsAt: new Date(new Date(startsAt).getTime() + 30 * 60_000),
          durationMinutes: 30,
          kind: 'SINGLE',
          status: 'CONFIRMED',
        },
      });
    }

    const response = await request(app)
      .get('/admin/lessons?from=2026-09-07&to=2026-09-07')
      .set('Authorization', admin);

    expect(response.body).toHaveLength(2);
  });

  it('narrows to one teacher when asked', async () => {
    const { location, teacher, plan } = await studioWithATeacher();
    const other = await createTeacher(prisma, { email: 'other@example.com' });
    const student = await createUser(prisma);

    for (const teacherId of [teacher.id, other.id]) {
      await prisma.lesson.create({
        data: {
          teacherId,
          studentId: student.id,
          locationId: location.id,
          pricePlanId: plan.id,
          startsAt: new Date(
            teacherId === teacher.id ? '2026-09-07T08:00:00Z' : '2026-09-07T12:00:00Z',
          ),
          endsAt: new Date(
            teacherId === teacher.id ? '2026-09-07T09:00:00Z' : '2026-09-07T13:00:00Z',
          ),
          durationMinutes: 60,
          kind: 'SINGLE',
          status: 'CONFIRMED',
        },
      });
    }

    const response = await request(app)
      .get(`/admin/lessons?from=2026-09-07&to=2026-09-07&teacherId=${teacher.id}`)
      .set('Authorization', admin);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].teacher.firstName).toBe('Ірина');
  });

  it('refuses a range wider than the limit rather than reading a year', async () => {
    const response = await request(app)
      .get('/admin/lessons?from=2026-01-01&to=2026-12-31')
      .set('Authorization', admin);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
  });
});

describe('POST /admin/lessons', () => {
  it('books the lesson for the named student, not for the admin', async () => {
    const { location, teacher, plan } = await studioWithATeacher();
    const student = await createUser(prisma, { firstName: 'Остап', lastName: 'Гнатюк' });

    const response = await request(app).post('/admin/lessons').set('Authorization', admin).send({
      teacherId: teacher.id,
      locationId: location.id,
      pricePlanId: plan.id,
      studentId: student.id,
      startsAt: '2026-09-07T08:00:00.000Z',
      kind: 'SINGLE',
    });

    expect(response.status).toBe(201);
    expect(response.body.student.firstName).toBe('Остап');

    // The whole point of the route: the row belongs to the child, so it shows
    // up in their cabinet and comes out of their package - not the admin's.
    const stored = await prisma.lesson.findFirst({ where: { studentId: student.id } });
    expect(stored).not.toBeNull();
  });

  it('still books for the caller when no student is named', async () => {
    const { location, teacher, plan } = await studioWithATeacher();

    const response = await request(app).post('/admin/lessons').set('Authorization', admin).send({
      teacherId: teacher.id,
      locationId: location.id,
      pricePlanId: plan.id,
      startsAt: '2026-09-07T08:00:00.000Z',
      kind: 'SINGLE',
    });

    expect(response.status).toBe(201);
    // The lesson shape carries no address, so the row is what proves whose it
    // is - which is the thing the route decides.
    const stored = await prisma.lesson.findFirst({ where: { id: response.body.id } });
    expect(stored?.studentId).toBe(adminId);
  });
});

describe('GET /admin/students', () => {
  it('lists the people taught, with what the studio would ring them about', async () => {
    const { teacher, plan } = await studioWithATeacher();
    const student = await createUser(prisma, { firstName: 'Соломія', lastName: 'Бойко' });

    await prisma.subscription.create({
      data: {
        studentId: student.id,
        teacherId: teacher.id,
        pricePlanId: plan.id,
        lessonsTotal: 8,
        lessonsUsed: 0,
        priceUah: 3200,
        validFrom: new Date('2026-01-01T00:00:00Z'),
        validTo: new Date('2036-12-31T00:00:00Z'),
        status: 'ACTIVE',
        paidAt: null,
      },
    });

    const response = await request(app).get('/admin/students').set('Authorization', admin);

    expect(response.status).toBe(200);
    const row = response.body.find((one: { firstName: string }) => one.firstName === 'Соломія');
    expect(row.unpaidSubscriptions).toBe(1);
  });

  it('leaves the teachers and the admin out of it', async () => {
    await studioWithATeacher();

    const response = await request(app).get('/admin/students').set('Authorization', admin);

    expect(response.body).toHaveLength(0);
  });

  it('matches one box against the name, the address and the phone', async () => {
    await createUser(prisma, { firstName: 'Соломія', lastName: 'Бойко', phone: '+380509998877' });
    await createUser(prisma, { firstName: 'Тарас', lastName: 'Мельник' });

    for (const term of ['бойко', '9998877', 'Соломія']) {
      const response = await request(app)
        .get(`/admin/students?q=${encodeURIComponent(term)}`)
        .set('Authorization', admin);

      expect({ term, found: response.body.length }).toEqual({ term, found: 1 });
    }
  });
});

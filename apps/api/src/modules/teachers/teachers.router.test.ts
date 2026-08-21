import { publicTeacherListSchema, publicTeacherSchema } from '@palitra/shared';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../http/app';
import { createTestPrisma, resetDatabase } from '../../test/database';
import { createDirection, createLocation, createTeacher } from '../../test/fixtures';
import { createTeachersRouter } from './teachers.router';
import { createTeachersService } from './teachers.service';

const prisma = createTestPrisma();

const app: Express = createApp({
  checkDatabase: async () => true,
  routers: [
    createTeachersRouter({
      // Nothing public sends an invitation; this file only reads.
      teachers: createTeachersService({ prisma, invite: { async sendInvite() {} } }),
    }),
  ],
});

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /teachers', () => {
  it('lists published teachers with their directions and locations', async () => {
    const location = await createLocation(prisma, { name: 'Благовісна' });
    const direction = await createDirection(prisma, { slug: 'vocal', name: 'Вокал' });
    await createTeacher(prisma, {
      firstName: 'Ірина',
      lastName: 'Мельник',
      experienceYears: 12,
      locationIds: [location.id],
      directionIds: [direction.id],
    });

    const response = await request(app).get('/teachers');

    expect(response.status).toBe(200);
    const body = publicTeacherListSchema.parse(response.body);
    expect(body).toHaveLength(1);
    expect(body[0]?.firstName).toBe('Ірина');
    expect(body[0]?.experienceYears).toBe(12);
    expect(body[0]?.directions.map((item) => item.slug)).toStrictEqual(['vocal']);
    expect(body[0]?.locations.map((item) => item.name)).toStrictEqual(['Благовісна']);
  });

  it('never publishes a teacher account`s email or phone', async () => {
    await createTeacher(prisma, { email: 'iryna@example.com', phone: '+380670000001' });

    const response = await request(app).get('/teachers');

    expect(JSON.stringify(response.body)).not.toContain('iryna@example.com');
    expect(JSON.stringify(response.body)).not.toContain('+380670000001');
  });

  it('leaves out drafts', async () => {
    await createTeacher(prisma, { isPublished: false });

    const response = await request(app).get('/teachers');

    expect(response.body).toStrictEqual([]);
  });
});

describe('GET /teachers/:id', () => {
  it('returns one teacher', async () => {
    const teacher = await createTeacher(prisma, { bio: 'Вокалістка з 2011 року' });

    const response = await request(app).get(`/teachers/${teacher.id}`);

    expect(response.status).toBe(200);
    expect(publicTeacherSchema.parse(response.body).bio).toBe('Вокалістка з 2011 року');
  });

  it('answers a draft profile exactly like a missing one', async () => {
    const draft = await createTeacher(prisma, { isPublished: false });

    const response = await request(app).get(`/teachers/${draft.id}`);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('answers 404 for a student account', async () => {
    const response = await request(app).get('/teachers/019880d3-0000-7000-8000-00000000dead');

    expect(response.status).toBe(404);
  });

  it('answers 404 rather than 400 for a path that is not an id', async () => {
    // A wrong address, not a malformed field: a 400 would confirm the route
    // exists to anything scanning for it.
    const response = await request(app).get('/teachers/banana');

    expect(response.status).toBe(404);
  });
});

describe('reference lists', () => {
  it('returns locations', async () => {
    await createLocation(prisma, { name: 'Шевченка', address: 'бул. Шевченка, 276' });

    const response = await request(app).get('/locations');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].address).toBe('бул. Шевченка, 276');
  });

  it('returns directions', async () => {
    await createDirection(prisma, { slug: 'guitar', name: 'Гітара' });

    const response = await request(app).get('/directions');

    expect(response.status).toBe(200);
    expect(response.body[0].slug).toBe('guitar');
  });
});

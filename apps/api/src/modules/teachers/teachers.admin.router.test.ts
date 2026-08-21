import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../http/app';
import { createAccessTokenService } from '../../lib/access-token';
import { createMemoryMailer } from '../../lib/mailer';
import { createTestPrisma, resetDatabase } from '../../test/database';
import { createAdminRouter } from '../admin/admin.router';
import { createAuthRouter } from '../auth/auth.router';
import { createAuthService } from '../auth/auth.service';
import { createAvailabilityRouter } from '../availability/availability.router';
import { createAvailabilityService } from '../availability/availability.service';
import { createTeachersAdminRouter } from './teachers.admin.router';
import { createTeachersRouter } from './teachers.router';
import { createTeachersService } from './teachers.service';

const prisma = createTestPrisma();
const mailer = createMemoryMailer();
const accessTokens = createAccessTokenService({ secret: 'test-secret'.repeat(4), ttlSeconds: 900 });

const auth = createAuthService({
  prisma,
  accessTokens,
  mailer,
  webOrigin: 'http://localhost:3000',
  bcryptCost: 4,
});

const teachers = createTeachersService({ prisma, invite: auth });

const app: Express = createApp({
  checkDatabase: async () => true,
  routers: [
    createAuthRouter({ auth, accessTokens, rateLimit: (_req, _res, next) => next() }),
    createTeachersRouter({ teachers }),
    // Mounted because deactivating a teacher is only meaningful if it reaches
    // the calendar: the assertion is about what the studio can still book.
    createAvailabilityRouter({ availability: createAvailabilityService({ prisma }), accessTokens }),
    createAdminRouter({ accessTokens, routers: [createTeachersAdminRouter({ teachers })] }),
  ],
});

let admin: string;

beforeEach(async () => {
  await resetDatabase(prisma);
  mailer.clear();
  admin = `Bearer ${await accessTokens.sign({
    userId: '0195c8a0-0000-7000-8000-000000000001',
    role: 'ADMIN',
  })}`;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const iryna = {
  email: 'iryna@example.com',
  firstName: 'Ірина',
  lastName: 'Шевченко',
  phone: '+380671112233',
};

function invite(overrides: Record<string, unknown> = {}) {
  return request(app)
    .post('/admin/teachers')
    .set('Authorization', admin)
    .send({ ...iryna, ...overrides });
}

function tokenFromLastMail(): string {
  const mail = mailer.sent.at(-1);
  const match = /token=([A-Za-z0-9_%-]+)/.exec(mail?.text ?? '');
  if (!match?.[1]) {
    throw new Error(`No token in the last mail: ${mail?.text ?? '(nothing was sent)'}`);
  }
  return decodeURIComponent(match[1]);
}

async function createDirection(name: string, slug: string): Promise<string> {
  const row = await prisma.direction.create({ data: { name, slug } });
  return row.id;
}

/**
 * The next Monday, always inside the booking horizon. A date written into the
 * test would sit outside that horizon by the autumn and the test would start
 * failing for a reason that has nothing to do with what it checks.
 */
function nextMonday(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7 || 7));
  return date.toISOString().slice(0, 10);
}

async function createLocation(name: string): Promise<string> {
  const row = await prisma.location.create({ data: { name, address: 'вул. Благовісна, 1' } });
  return row.id;
}

describe('POST /admin/teachers', () => {
  it('is not something a visitor can do', async () => {
    // The guard itself is tested route by route in `admin.router.test.ts`.
    // This is the check that these routes are behind it at all - the staff
    // list carries every teacher's address and phone.
    const response = await request(app).post('/admin/teachers').send(iryna);

    expect(response.status).toBe(401);
    expect(mailer.sent).toHaveLength(0);
  });

  it('creates the account and mails an invitation to it', async () => {
    const response = await invite();

    expect(response.status).toBe(201);
    expect(response.body.email).toBe('iryna@example.com');
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.to).toBe('iryna@example.com');
    expect(mailer.sent[0]?.text).toContain('http://localhost:3000/accept-invite?token=');
  });

  it('makes a teacher who cannot yet be signed in as', async () => {
    await invite();

    const user = await prisma.user.findFirstOrThrow({ where: { email: iryna.email } });
    expect(user.role).toBe('TEACHER');
    // The account exists before the password does, and until the invitation is
    // accepted there is nothing to compare a login against.
    expect(user.passwordHash).toBeNull();
    expect(user.emailVerifiedAt).toBeNull();
  });

  it('keeps the new teacher off the public site until they are published', async () => {
    await invite();

    const publicList = await request(app).get('/teachers');
    const adminList = await request(app).get('/admin/teachers').set('Authorization', admin);

    // A profile with no photo and no bio is not something to show visitors;
    // the studio publishes it once the teacher has sent their picture.
    expect(publicList.body).toHaveLength(0);
    expect(adminList.body).toHaveLength(1);
    expect(adminList.body[0].hasPassword).toBe(false);
  });

  it('lets the invited teacher set a password and sign in', async () => {
    await invite();

    const accepted = await request(app)
      .post('/auth/accept-invite')
      .send({ token: tokenFromLastMail(), password: 'correct horse battery' });

    expect(accepted.status).toBe(200);
    expect(accepted.body.user.role).toBe('TEACHER');

    const adminList = await request(app).get('/admin/teachers').set('Authorization', admin);
    expect(adminList.body[0].hasPassword).toBe(true);
  });

  it('refuses an address that already has an account', async () => {
    await invite();

    const again = await invite({ firstName: 'Інша' });

    expect(again.status).toBe(409);
    expect(again.body.code).toBe('EMAIL_TAKEN');
    // The second letter is the giveaway that would matter most: it would tell
    // whoever asked that this address is already registered here.
    expect(mailer.sent).toHaveLength(1);
  });
});

describe('PATCH /admin/teachers/:id', () => {
  async function invited(): Promise<string> {
    const { body } = await invite();
    return body.id as string;
  }

  it('edits the profile and the person in one request', async () => {
    const id = await invited();

    const response = await request(app)
      .patch(`/admin/teachers/${id}`)
      .set('Authorization', admin)
      .send({ lastName: 'Шевченко-Коваль', bio: 'Викладає вокал 12 років', experienceYears: 12 });

    expect(response.status).toBe(200);
    // The name lives on the account and the bio on the profile; the screen
    // edits one card and should not have to know that.
    expect(response.body.lastName).toBe('Шевченко-Коваль');
    expect(response.body.bio).toBe('Викладає вокал 12 років');
    expect(response.body.experienceYears).toBe(12);
  });

  it('puts the teacher on the site when they are published', async () => {
    const id = await invited();

    await request(app)
      .patch(`/admin/teachers/${id}`)
      .set('Authorization', admin)
      .send({ isPublished: true });

    const publicList = await request(app).get('/teachers');
    expect(publicList.body).toHaveLength(1);
    expect(publicList.body[0].firstName).toBe('Ірина');
  });

  it('answers 404 for a teacher that does not exist', async () => {
    const response = await request(app)
      .patch('/admin/teachers/0195c8a0-0000-7000-8000-0000000000ff')
      .set('Authorization', admin)
      .send({ isPublished: true });

    expect(response.status).toBe(404);
  });
});

describe('PUT /admin/teachers/:id/directions and /locations', () => {
  async function invited(): Promise<string> {
    const { body } = await invite();
    await request(app)
      .patch(`/admin/teachers/${body.id}`)
      .set('Authorization', admin)
      .send({ isPublished: true });
    return body.id as string;
  }

  it('replaces the whole set rather than adding to it', async () => {
    const id = await invited();
    const vocals = await createDirection('Вокал', 'vokal');
    const piano = await createDirection('Фортепіано', 'fortepiano');

    await request(app)
      .put(`/admin/teachers/${id}/directions`)
      .set('Authorization', admin)
      .send({ ids: [vocals, piano] });

    const response = await request(app)
      .put(`/admin/teachers/${id}/directions`)
      .set('Authorization', admin)
      .send({ ids: [piano] });

    expect(response.status).toBe(200);
    expect(response.body.directions).toHaveLength(1);
    expect(response.body.directions[0].slug).toBe('fortepiano');
  });

  it('shows the directions on the public card', async () => {
    const id = await invited();
    const vocals = await createDirection('Вокал', 'vokal');

    await request(app)
      .put(`/admin/teachers/${id}/directions`)
      .set('Authorization', admin)
      .send({ ids: [vocals] });

    const { body } = await request(app).get(`/teachers/${id}`);
    expect(body.directions[0].name).toBe('Вокал');
  });

  it('links the addresses a teacher works at', async () => {
    const id = await invited();
    const blahovisna = await createLocation('Благовісна');

    const response = await request(app)
      .put(`/admin/teachers/${id}/locations`)
      .set('Authorization', admin)
      .send({ ids: [blahovisna] });

    expect(response.status).toBe(200);
    expect(response.body.locations[0].name).toBe('Благовісна');
  });

  it('refuses a direction that does not exist and changes nothing', async () => {
    const id = await invited();
    const vocals = await createDirection('Вокал', 'vokal');
    await request(app)
      .put(`/admin/teachers/${id}/directions`)
      .set('Authorization', admin)
      .send({ ids: [vocals] });

    const response = await request(app)
      .put(`/admin/teachers/${id}/directions`)
      .set('Authorization', admin)
      .send({ ids: ['0195c8a0-0000-7000-8000-0000000000ff'] });

    expect(response.status).toBe(400);
    // The set is replaced in one transaction, so a bad id leaves the teacher
    // with the subjects they had rather than with none.
    const after = await request(app).get(`/teachers/${id}`);
    expect(after.body.directions).toHaveLength(1);
  });
});

describe('POST /admin/teachers/:id/reinvite', () => {
  it('mails a fresh link and stops the previous one working', async () => {
    const { body } = await invite();
    const first = tokenFromLastMail();

    const response = await request(app)
      .post(`/admin/teachers/${body.id}/reinvite`)
      .set('Authorization', admin);

    expect(response.status).toBe(204);
    expect(mailer.sent).toHaveLength(2);

    // The usual reason for re-inviting is that the first letter went astray.
    // Wherever it went, it must stop being a key to the account.
    const stale = await request(app)
      .post('/auth/accept-invite')
      .send({ token: first, password: 'correct horse battery' });
    expect(stale.status).toBe(401);
    expect(stale.body.code).toBe('INVALID_TOKEN');

    const fresh = await request(app)
      .post('/auth/accept-invite')
      .send({ token: tokenFromLastMail(), password: 'correct horse battery' });
    expect(fresh.status).toBe(200);
  });

  it('refuses to re-invite a teacher who already has a password', async () => {
    const { body } = await invite();
    await request(app)
      .post('/auth/accept-invite')
      .send({ token: tokenFromLastMail(), password: 'correct horse battery' });

    const response = await request(app)
      .post(`/admin/teachers/${body.id}/reinvite`)
      .set('Authorization', admin);

    // An "invitation" to someone who has been teaching for a year is really a
    // password reset, and the studio must not be able to start one for an
    // account it does not own. That flow belongs to the teacher themselves.
    expect(response.status).toBe(400);
    expect(mailer.sent).toHaveLength(1);
  });
});

describe('a teacher who has left', () => {
  it('takes no new bookings once they are deactivated', async () => {
    const { body } = await invite();
    const location = await createLocation('Благовісна');

    await prisma.availabilityRule.create({
      data: {
        teacherId: body.id,
        locationId: location,
        weekday: 1,
        startMinute: 10 * 60,
        endMinute: 18 * 60,
        validFrom: new Date('2020-01-01'),
      },
    });

    const day = nextMonday();
    const monday = { from: day, to: day, duration: '60' };
    const before = await request(app).get(`/teachers/${body.id}`);
    const offered = await request(app).get(`/teachers/${body.id}/slots`).query(monday);

    expect(before.status).toBe(404); // unpublished, and that is a separate switch
    expect(offered.body.slots.length).toBeGreaterThan(0);

    await request(app)
      .patch(`/admin/teachers/${body.id}`)
      .set('Authorization', admin)
      .send({ isActive: false });

    const after = await request(app).get(`/teachers/${body.id}/slots`).query(monday);

    // Their finished lessons stay in the history - that is why there is no
    // delete button - but the calendar stops offering their time.
    expect(after.body.slots).toHaveLength(0);
  });
});

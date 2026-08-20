import { authResponseSchema, publicUserSchema } from '@palitra/shared';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../http/app';
import { createAccessTokenService } from '../../lib/access-token';
import { createMemoryMailer } from '../../lib/mailer';
import { createTestPrisma, resetDatabase } from '../../test/database';
import { createAuthRouter } from './auth.router';
import { createAuthService } from './auth.service';

const prisma = createTestPrisma();
const mailer = createMemoryMailer();
const accessTokens = createAccessTokenService({ secret: 'test-secret'.repeat(4), ttlSeconds: 900 });

const auth = createAuthService({
  prisma,
  accessTokens,
  mailer,
  webOrigin: 'http://localhost:3000',
  // The work factor is the point of bcrypt in production and pure cost here.
  bcryptCost: 4,
});

const app: Express = createApp({
  checkDatabase: async () => true,
  routers: [
    createAuthRouter({
      auth,
      accessTokens,
      // Throttling is exercised by its own configuration, not by every test
      // in this file taking one of the twenty allowed attempts.
      rateLimit: (_req, _res, next) => next(),
    }),
  ],
});

const registration = {
  email: 'olena@example.com',
  password: 'correct horse battery',
  firstName: 'Олена',
  lastName: 'Коваль',
  phone: '+380671234567',
};

beforeEach(async () => {
  await resetDatabase(prisma);
  mailer.clear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function register(overrides: Partial<typeof registration> = {}) {
  return request(app)
    .post('/auth/register')
    .send({ ...registration, ...overrides });
}

function tokenFromLastMail(): string {
  const mail = mailer.sent.at(-1);
  const match = /token=([A-Za-z0-9_%-]+)/.exec(mail?.text ?? '');
  if (!match?.[1]) {
    throw new Error(`No token in the last mail: ${mail?.text ?? '(nothing was sent)'}`);
  }
  return decodeURIComponent(match[1]);
}

describe('POST /auth/register', () => {
  it('creates a student and returns a usable session', async () => {
    const response = await register();

    expect(response.status).toBe(201);
    const body = authResponseSchema.parse(response.body);
    expect(body.user.role).toBe('STUDENT');
    expect(body.user.email).toBe('olena@example.com');
    expect(body.accessTokenExpiresIn).toBe(900);
    await expect(accessTokens.verify(body.accessToken)).resolves.toEqual({
      userId: body.user.id,
      role: 'STUDENT',
    });
  });

  it('never returns the password or its hash', async () => {
    const response = await register();

    expect(JSON.stringify(response.body)).not.toContain(registration.password);
    expect(JSON.stringify(response.body)).not.toContain('$2b$');
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  it('stores the password only as a hash', async () => {
    await register();

    const user = await prisma.user.findUniqueOrThrow({ where: { email: registration.email } });
    expect(user.passwordHash).not.toBe(registration.password);
    // Someone who registered has a password; only an invited account may sit
    // there without one, and this is not that path.
    expect(user.passwordHash?.startsWith('$2')).toBe(true);
  });

  it('leaves the email unverified and sends a verification link', async () => {
    const response = await register();

    expect(response.body.user.emailVerifiedAt).toBeNull();
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.to).toBe(registration.email);
    expect(mailer.sent[0]?.text).toContain('http://localhost:3000/verify-email?token=');
  });

  it('stores the verification token only as a digest', async () => {
    await register();
    const token = tokenFromLastMail();

    const stored = await prisma.oneTimeToken.findFirstOrThrow();
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.kind).toBe('EMAIL_VERIFICATION');
  });

  it('rejects a second registration with the same email', async () => {
    await register();

    const response = await register();

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EMAIL_TAKEN');
  });

  it('treats an email that differs only in case as the same account', async () => {
    await register();

    const response = await register({ email: 'Olena@Example.COM' });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EMAIL_TAKEN');
  });

  it('reports every invalid field at once', async () => {
    const response = await register({ email: 'not-an-email', password: 'short', phone: '12' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(response.body.details)).toEqual(
      expect.arrayContaining(['email', 'password', 'phone']),
    );
  });
});

describe('POST /auth/login', () => {
  it('returns a session for the right password', async () => {
    await register();

    const response = await request(app)
      .post('/auth/login')
      .send({ email: registration.email, password: registration.password });

    expect(response.status).toBe(200);
    expect(authResponseSchema.parse(response.body).user.email).toBe(registration.email);
  });

  it('answers a wrong password and an unknown account identically', async () => {
    await register();

    const wrongPassword = await request(app)
      .post('/auth/login')
      .send({ email: registration.email, password: 'not the password' });
    const unknownAccount = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'not the password' });

    // Any difference here - status, code or wording - answers the question
    // "does this person attend the studio?" for anyone who cares to ask.
    expect(wrongPassword.status).toBe(401);
    expect(unknownAccount.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownAccount.body);
    expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the refresh token and invalidates the old one', async () => {
    const { body: session } = await register();

    const refreshed = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    expect(refreshed.status).toBe(200);
    const rotated = authResponseSchema.parse(refreshed.body);
    expect(rotated.refreshToken).not.toBe(session.refreshToken);

    const replayed = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken });
    expect(replayed.status).toBe(401);
    expect(replayed.body.code).toBe('INVALID_TOKEN');
  });

  it('drops every session of the user when a rotated token is replayed', async () => {
    const { body: stolen } = await register();
    const { body: rotated } = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: stolen.refreshToken });

    // The thief replays the token they captured before the owner refreshed.
    await request(app).post('/auth/refresh').send({ refreshToken: stolen.refreshToken });

    // The owner's current token must die too: we cannot tell which of the two
    // is the legitimate client, and leaving the thief with a live chain is
    // the worse of the two mistakes.
    const owner = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: rotated.refreshToken });
    expect(owner.status).toBe(401);
  });

  it('rejects a token that was never issued', async () => {
    const response = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'x'.repeat(43) });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_TOKEN');
  });

  it('rejects an expired token', async () => {
    const { body: session } = await register();
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const response = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    expect(response.status).toBe(401);
  });

  it('records the user agent so a session list can name the device', async () => {
    await request(app)
      .post('/auth/register')
      .set('user-agent', 'Mozilla/5.0 (iPhone)')
      .send(registration);

    const stored = await prisma.refreshToken.findFirstOrThrow();
    expect(stored.userAgent).toBe('Mozilla/5.0 (iPhone)');
  });
});

describe('POST /auth/logout', () => {
  it('kills the session and stays quiet when repeated', async () => {
    const { body: session } = await register();

    const first = await request(app).post('/auth/logout').send({
      refreshToken: session.refreshToken,
    });
    const second = await request(app).post('/auth/logout').send({
      refreshToken: session.refreshToken,
    });

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);

    const refreshed = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken });
    expect(refreshed.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('returns the signed-in user', async () => {
    const { body: session } = await register();

    const response = await request(app)
      .get('/auth/me')
      .set('authorization', `Bearer ${session.accessToken}`);

    expect(response.status).toBe(200);
    expect(publicUserSchema.parse(response.body).id).toBe(session.user.id);
  });

  it('refuses an anonymous or malformed request', async () => {
    const anonymous = await request(app).get('/auth/me');
    const malformed = await request(app).get('/auth/me').set('authorization', 'Bearer nonsense');

    expect(anonymous.status).toBe(401);
    expect(anonymous.body.code).toBe('UNAUTHENTICATED');
    expect(malformed.status).toBe(401);
  });
});

describe('POST /auth/verify-email', () => {
  it('confirms the address from the emailed link', async () => {
    await register();

    const response = await request(app)
      .post('/auth/verify-email')
      .send({ token: tokenFromLastMail() });

    expect(response.status).toBe(200);
    expect(publicUserSchema.parse(response.body).emailVerifiedAt).not.toBeNull();
  });

  it('accepts a second click on the same link', async () => {
    await register();
    const token = tokenFromLastMail();
    await request(app).post('/auth/verify-email').send({ token });

    const again = await request(app).post('/auth/verify-email').send({ token });

    // Mail clients prefetch links and people click twice; an error page for a
    // confirmation that did work is a support call for nothing.
    expect(again.status).toBe(200);
  });

  it('rejects an unknown or expired link', async () => {
    await register();
    await prisma.oneTimeToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const expired = await request(app)
      .post('/auth/verify-email')
      .send({ token: tokenFromLastMail() });
    const unknown = await request(app).post('/auth/verify-email').send({ token: 'nope' });

    expect(expired.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body.code).toBe('INVALID_TOKEN');
  });

  it('does not let a verification link be redeemed as a password reset', async () => {
    await register();

    const response = await request(app)
      .post('/auth/password-reset/confirm')
      .send({ token: tokenFromLastMail(), password: 'a brand new password' });

    expect(response.status).toBe(401);
  });
});

describe('password reset', () => {
  it('answers the same for a known and an unknown address', async () => {
    await register();
    mailer.clear();

    const known = await request(app)
      .post('/auth/password-reset/request')
      .send({ email: registration.email });
    const unknown = await request(app)
      .post('/auth/password-reset/request')
      .send({ email: 'nobody@example.com' });

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.to).toBe(registration.email);
  });

  it('replaces the password and lets the old one stop working', async () => {
    await register();
    mailer.clear();
    await request(app).post('/auth/password-reset/request').send({ email: registration.email });

    const confirmed = await request(app)
      .post('/auth/password-reset/confirm')
      .send({ token: tokenFromLastMail(), password: 'a brand new password' });

    expect(confirmed.status).toBe(204);

    const withOld = await request(app)
      .post('/auth/login')
      .send({ email: registration.email, password: registration.password });
    const withNew = await request(app)
      .post('/auth/login')
      .send({ email: registration.email, password: 'a brand new password' });

    expect(withOld.status).toBe(401);
    expect(withNew.status).toBe(200);
  });

  it('signs every existing session out', async () => {
    const { body: session } = await register();
    mailer.clear();
    await request(app).post('/auth/password-reset/request').send({ email: registration.email });
    await request(app)
      .post('/auth/password-reset/confirm')
      .send({ token: tokenFromLastMail(), password: 'a brand new password' });

    const refreshed = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    // Whoever asked for the reset may be locking an intruder out.
    expect(refreshed.status).toBe(401);
  });

  it('confirms the address, since following the link proves the mailbox is theirs', async () => {
    await register();
    mailer.clear();
    await request(app).post('/auth/password-reset/request').send({ email: registration.email });
    await request(app)
      .post('/auth/password-reset/confirm')
      .send({ token: tokenFromLastMail(), password: 'a brand new password' });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: registration.email } });
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  it('burns the link after one use', async () => {
    await register();
    mailer.clear();
    await request(app).post('/auth/password-reset/request').send({ email: registration.email });
    const token = tokenFromLastMail();
    await request(app)
      .post('/auth/password-reset/confirm')
      .send({ token, password: 'a brand new password' });

    const reused = await request(app)
      .post('/auth/password-reset/confirm')
      .send({ token, password: 'yet another password' });

    expect(reused.status).toBe(401);
  });

  it('invalidates an earlier link when a new one is requested', async () => {
    await register();
    mailer.clear();
    await request(app).post('/auth/password-reset/request').send({ email: registration.email });
    const firstToken = tokenFromLastMail();
    await request(app).post('/auth/password-reset/request').send({ email: registration.email });

    const response = await request(app)
      .post('/auth/password-reset/confirm')
      .send({ token: firstToken, password: 'a brand new password' });

    // Otherwise every letter ever sent stays a live key for its full hour.
    expect(response.status).toBe(401);
  });

  it('enforces the password rules on the new password', async () => {
    await register();
    mailer.clear();
    await request(app).post('/auth/password-reset/request').send({ email: registration.email });

    const response = await request(app)
      .post('/auth/password-reset/confirm')
      .send({ token: tokenFromLastMail(), password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
  });
});

describe('POST /auth/accept-invite', () => {
  /**
   * The state an invitation starts from: an account the admin created, with a
   * role and a name but no password at all. Written through Prisma rather than
   * through the admin endpoint so that this file tests one router, not two.
   */
  async function inviteTeacher() {
    const user = await prisma.user.create({
      data: {
        email: 'iryna@example.com',
        passwordHash: null,
        role: 'TEACHER',
        firstName: 'Ірина',
        lastName: 'Шевченко',
        phone: '+380671112233',
      },
    });
    await auth.sendInvite(user);
    return user;
  }

  it('sends a link to the invited address', async () => {
    await inviteTeacher();

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.to).toBe('iryna@example.com');
    expect(mailer.sent[0]?.text).toContain('http://localhost:3000/accept-invite?token=');
  });

  it('sets the password and signs the teacher in', async () => {
    await inviteTeacher();

    const response = await request(app)
      .post('/auth/accept-invite')
      .send({ token: tokenFromLastMail(), password: 'correct horse battery' });

    expect(response.status).toBe(200);
    expect(() => authResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.user.role).toBe('TEACHER');
  });

  it('confirms the address, because following the link proves the mailbox', async () => {
    await inviteTeacher();

    await request(app)
      .post('/auth/accept-invite')
      .send({ token: tokenFromLastMail(), password: 'correct horse battery' });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'iryna@example.com' } });
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  it('refuses to sign in an invited teacher who has not set a password yet', async () => {
    await inviteTeacher();

    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'iryna@example.com', password: '' });

    // The account exists and has no password. Nothing may be accepted as one -
    // this is what the `?? ABSENT_USER_HASH` in `login` is guarding, and it is
    // easy to remove by someone who does not know why it is there.
    expect(response.status).toBe(400);

    const anything = await request(app)
      .post('/auth/login')
      .send({ email: 'iryna@example.com', password: 'correct horse battery' });

    expect(anything.status).toBe(401);
  });

  it('spends the invitation, so the link cannot be used twice', async () => {
    await inviteTeacher();
    const token = tokenFromLastMail();

    await request(app).post('/auth/accept-invite').send({ token, password: 'correct horse battery' });
    const again = await request(app)
      .post('/auth/accept-invite')
      .send({ token, password: 'somebody elses password' });

    expect(again.status).toBe(401);
  });

  it('does not accept an invitation at the password reset endpoint', async () => {
    await inviteTeacher();

    const response = await request(app)
      .post('/auth/password-reset/confirm')
      .send({ token: tokenFromLastMail(), password: 'correct horse battery' });

    // The whole reason `kind` exists on the token: an invitation and a reset
    // are not interchangeable keys.
    expect(response.status).toBe(401);
  });
});

import { describe, expect, it } from 'vitest';
import {
  authResponseSchema,
  loginRequestSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  publicUserSchema,
  refreshRequestSchema,
  registerRequestSchema,
  USER_ROLES,
  verifyEmailRequestSchema,
} from './auth';

const validRegistration = {
  email: 'olena@example.com',
  password: 'correct horse battery',
  firstName: 'Олена',
  lastName: 'Коваль',
  phone: '+380671234567',
};

describe('registerRequestSchema', () => {
  it('accepts a valid registration', () => {
    expect(registerRequestSchema.parse(validRegistration).email).toBe('olena@example.com');
  });

  it('normalises the email to lower case and trims it', () => {
    const parsed = registerRequestSchema.parse({
      ...validRegistration,
      email: '  Olena@Example.COM ',
    });
    expect(parsed.email).toBe('olena@example.com');
  });

  it('trims names so a trailing space cannot create a second "Олена "', () => {
    const parsed = registerRequestSchema.parse({ ...validRegistration, firstName: ' Олена ' });
    expect(parsed.firstName).toBe('Олена');
  });

  it('rejects a password shorter than eight characters', () => {
    expect(() =>
      registerRequestSchema.parse({ ...validRegistration, password: 'Abc123!' }),
    ).toThrow();
  });

  it('rejects a password longer than 72 bytes, which bcrypt would silently truncate', () => {
    // 40 Cyrillic characters are 80 bytes in UTF-8, so a length check in
    // characters would let this through and bcrypt would hash only a prefix.
    const password = 'п'.repeat(40);
    expect(password.length).toBeLessThan(72);
    expect(() => registerRequestSchema.parse({ ...validRegistration, password })).toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => registerRequestSchema.parse({ ...validRegistration, lastName: '   ' })).toThrow();
  });

  it('rejects a malformed email', () => {
    expect(() => registerRequestSchema.parse({ ...validRegistration, email: 'olena@' })).toThrow();
  });

  it('rejects a phone without enough digits', () => {
    expect(() => registerRequestSchema.parse({ ...validRegistration, phone: '+38067' })).toThrow();
  });

  it('accepts a phone written with spaces and brackets', () => {
    const parsed = registerRequestSchema.parse({
      ...validRegistration,
      phone: '+380 (67) 123-45-67',
    });
    expect(parsed.phone).toBe('+380 (67) 123-45-67');
  });
});

describe('loginRequestSchema', () => {
  it('accepts credentials and normalises the email', () => {
    const parsed = loginRequestSchema.parse({ email: 'A@B.COM', password: 'whatever' });
    expect(parsed.email).toBe('a@b.com');
  });

  it('does not apply registration password rules to login', () => {
    // An account created before the rules tightened must still be able to log in.
    expect(() => loginRequestSchema.parse({ email: 'a@b.com', password: 'old' })).not.toThrow();
  });

  it('rejects an empty password', () => {
    expect(() => loginRequestSchema.parse({ email: 'a@b.com', password: '' })).toThrow();
  });
});

describe('publicUserSchema', () => {
  const user = {
    id: 'c0e5f3a2-1b4d-4c8e-9f7a-2d6b8e0a1c34',
    email: 'olena@example.com',
    role: 'STUDENT',
    firstName: 'Олена',
    lastName: 'Коваль',
    phone: '+380671234567',
    emailVerifiedAt: null,
  };

  it('accepts an unverified user', () => {
    expect(publicUserSchema.parse(user).emailVerifiedAt).toBeNull();
  });

  it('accepts an iso timestamp for a verified user', () => {
    const parsed = publicUserSchema.parse({ ...user, emailVerifiedAt: '2026-08-13T09:00:00.000Z' });
    expect(parsed.emailVerifiedAt).toBe('2026-08-13T09:00:00.000Z');
  });

  it('rejects an unknown role', () => {
    expect(() => publicUserSchema.parse({ ...user, role: 'SUPERUSER' })).toThrow();
  });

  it('has no field that could carry the password hash', () => {
    const parsed = publicUserSchema.parse({ ...user, passwordHash: '$2b$12$leaked' });
    expect(parsed).not.toHaveProperty('passwordHash');
  });

  it('covers exactly the three roles of the spec', () => {
    expect([...USER_ROLES]).toEqual(['ADMIN', 'TEACHER', 'STUDENT']);
  });
});

describe('authResponseSchema', () => {
  const response = {
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
    refreshToken: 'a'.repeat(64),
    accessTokenExpiresIn: 900,
  };

  it('accepts a full auth response', () => {
    expect(authResponseSchema.parse(response).accessTokenExpiresIn).toBe(900);
  });

  it('rejects a response without a refresh token', () => {
    const { refreshToken: _refreshToken, ...withoutRefresh } = response;
    expect(() => authResponseSchema.parse(withoutRefresh)).toThrow();
  });
});

describe('token-carrying request schemas', () => {
  it('accepts a refresh request', () => {
    expect(refreshRequestSchema.parse({ refreshToken: 'x'.repeat(64) }).refreshToken).toHaveLength(
      64,
    );
  });

  it('rejects an empty refresh token', () => {
    expect(() => refreshRequestSchema.parse({ refreshToken: '' })).toThrow();
  });

  it('accepts an email verification request', () => {
    expect(verifyEmailRequestSchema.parse({ token: 'abc' }).token).toBe('abc');
  });

  it('accepts a password reset request and normalises the email', () => {
    expect(passwordResetRequestSchema.parse({ email: ' Olena@Example.com ' }).email).toBe(
      'olena@example.com',
    );
  });

  it('applies the registration password rules when resetting', () => {
    expect(() => passwordResetSchema.parse({ token: 'abc', password: 'short' })).toThrow();
    expect(passwordResetSchema.parse({ token: 'abc', password: 'a new long password' }).token).toBe(
      'abc',
    );
  });
});

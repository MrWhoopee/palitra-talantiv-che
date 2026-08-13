import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

const required = {
  DATABASE_URL: 'postgresql://localhost:5433/palitra',
  JWT_SECRET: 'a'.repeat(32),
};

describe('loadEnv', () => {
  it('applies defaults when optional variables are absent', () => {
    const env = loadEnv(required);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.WEB_ORIGIN).toBe('http://localhost:3000');
    expect(env.SMTP_HOST).toBe('localhost');
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.MAIL_FROM).toContain('@');
  });

  it('coerces PORT from a string to a number', () => {
    const env = loadEnv({ ...required, PORT: '5050' });

    expect(env.PORT).toBe(5050);
    expect(typeof env.PORT).toBe('number');
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadEnv({ JWT_SECRET: required.JWT_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('throws when PORT is not a positive integer', () => {
    expect(() => loadEnv({ ...required, PORT: '-1' })).toThrow();
    expect(() => loadEnv({ ...required, PORT: 'not-a-number' })).toThrow();
  });

  it('throws when JWT_SECRET is missing', () => {
    // No default on purpose: a fallback secret would ship to production
    // unnoticed and every access token in the system would be forgeable.
    expect(() => loadEnv({ DATABASE_URL: required.DATABASE_URL })).toThrow(/JWT_SECRET/);
  });

  it('throws when JWT_SECRET is too short to be a real key', () => {
    expect(() => loadEnv({ ...required, JWT_SECRET: 'short-secret' })).toThrow(/JWT_SECRET/);
  });
});

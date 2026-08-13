import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

describe('loadEnv', () => {
  it('applies defaults when optional variables are absent', () => {
    const env = loadEnv({ DATABASE_URL: 'postgresql://localhost:5433/palitra' });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.WEB_ORIGIN).toBe('http://localhost:3000');
  });

  it('coerces PORT from a string to a number', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://localhost:5433/palitra',
      PORT: '5050',
    });

    expect(env.PORT).toBe(5050);
    expect(typeof env.PORT).toBe('number');
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('throws when PORT is not a positive integer', () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: 'postgresql://localhost:5433/palitra',
        PORT: '-1',
      }),
    ).toThrow();

    expect(() =>
      loadEnv({
        DATABASE_URL: 'postgresql://localhost:5433/palitra',
        PORT: 'not-a-number',
      }),
    ).toThrow();
  });
});

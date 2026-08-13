import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

// A low cost keeps the suite fast; production uses the module default.
const TEST_COST = 4;

describe('hashPassword', () => {
  it('never returns the plain password', async () => {
    const hash = await hashPassword('correct horse battery', TEST_COST);

    expect(hash).not.toContain('correct horse battery');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('produces a different hash every time thanks to the salt', async () => {
    const [first, second] = await Promise.all([
      hashPassword('correct horse battery', TEST_COST),
      hashPassword('correct horse battery', TEST_COST),
    ]);

    expect(first).not.toBe(second);
  });
});

describe('verifyPassword', () => {
  it('accepts the right password', async () => {
    const hash = await hashPassword('correct horse battery', TEST_COST);

    await expect(verifyPassword('correct horse battery', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse battery', TEST_COST);

    await expect(verifyPassword('correct horse batterz', hash)).resolves.toBe(false);
  });

  it('handles a non-ascii password', async () => {
    const hash = await hashPassword('пароль-українською', TEST_COST);

    await expect(verifyPassword('пароль-українською', hash)).resolves.toBe(true);
    await expect(verifyPassword('пароль-українськоЮ', hash)).resolves.toBe(false);
  });

  it('returns false instead of throwing on a corrupted stored hash', async () => {
    // A row damaged by a bad migration must fail the login, not crash the
    // request with a 500 that confirms the account exists.
    await expect(verifyPassword('anything', 'not-a-bcrypt-hash')).resolves.toBe(false);
    await expect(verifyPassword('anything', '')).resolves.toBe(false);
  });
});

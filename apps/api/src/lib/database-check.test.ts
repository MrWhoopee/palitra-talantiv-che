import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabaseCheck } from './database-check';

describe('createDatabaseCheck', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when the query succeeds', async () => {
    const check = createDatabaseCheck({ $queryRaw: async () => [{ ok: 1 }] });
    await expect(check()).resolves.toBe(true);
  });

  it('returns false when the query rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const check = createDatabaseCheck({
      $queryRaw: async () => {
        throw new Error('connection refused');
      },
    });
    await expect(check()).resolves.toBe(false);
    expect(consoleError).toHaveBeenCalled();
  });

  it('does not leak the underlying error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const check = createDatabaseCheck({
      $queryRaw: async () => {
        throw new Error('password authentication failed for user "palitra"');
      },
    });
    await expect(check()).resolves.toBe(false);
    expect(consoleError).toHaveBeenCalled();
  });
});

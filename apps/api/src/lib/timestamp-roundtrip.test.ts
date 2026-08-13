import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import { prisma } from './prisma';

/**
 * Storage is `timestamptz`, always UTC on disk — that was never the bug.
 * The bug lives in the *session* timezone the driver decodes against: if the
 * connection's `TimeZone` GUC is anything other than UTC, Postgres formats
 * the wire value using that offset and the decoded `Date` silently drifts
 * by the offset. `to_timestamp(epochSeconds)` picks an unambiguous instant
 * server-side, independent of session timezone, so any mismatch here can
 * only come from decoding, not from what got stored.
 *
 * This test needs the real database (it is not mocked) and therefore
 * requires the docker-compose postgres service and a valid DATABASE_URL.
 */
describe('timestamptz round-trip', () => {
  it('decodes a timestamptz to the exact instant regardless of session timezone', async () => {
    const trueInstant = new Date('2026-08-13T18:18:26.210Z');
    const epochSeconds = trueInstant.getTime() / 1000;

    const rows = await prisma.$queryRaw<{ ts: Date }[]>`SELECT to_timestamp(${epochSeconds}) AS ts`;

    expect(rows[0]?.ts.getTime()).toBe(trueInstant.getTime());
  });
});

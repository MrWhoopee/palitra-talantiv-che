import { describe, expect, it } from 'vitest';
import {
  availabilityExceptionInputSchema,
  availabilityRuleInputSchema,
  slotQuerySchema,
} from './availability';

const LOCATION_ID = '019880d3-0000-7000-8000-000000000001';

function rule(overrides: Record<string, unknown> = {}) {
  return {
    locationId: LOCATION_ID,
    weekday: 2,
    startTime: '10:00',
    endTime: '18:00',
    validFrom: '2026-09-01',
    ...overrides,
  };
}

describe('availabilityRuleInputSchema', () => {
  it('accepts a working window', () => {
    expect(availabilityRuleInputSchema.safeParse(rule()).success).toBe(true);
  });

  it('rejects a window that ends before it starts', () => {
    const result = availabilityRuleInputSchema.safeParse(rule({ endTime: '09:00' }));
    expect(result.success).toBe(false);
  });

  it('rejects a zero-length window', () => {
    expect(availabilityRuleInputSchema.safeParse(rule({ endTime: '10:00' })).success).toBe(false);
  });

  it('rejects a weekday outside 0-6', () => {
    expect(availabilityRuleInputSchema.safeParse(rule({ weekday: 7 })).success).toBe(false);
  });

  it('rejects a validity range that ends before it starts', () => {
    const result = availabilityRuleInputSchema.safeParse(
      rule({ validFrom: '2026-09-01', validTo: '2026-08-01' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a date that is not on the calendar', () => {
    expect(availabilityRuleInputSchema.safeParse(rule({ validFrom: '2026-02-31' })).success).toBe(
      false,
    );
  });
});

describe('availabilityExceptionInputSchema', () => {
  it('accepts a range with a note', () => {
    const result = availabilityExceptionInputSchema.safeParse({
      startsAt: '2026-09-01T09:00:00.000Z',
      endsAt: '2026-09-05T18:00:00.000Z',
      kind: 'VACATION',
      note: 'Відпустка',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty range', () => {
    const result = availabilityExceptionInputSchema.safeParse({
      startsAt: '2026-09-01T09:00:00.000Z',
      endsAt: '2026-09-01T09:00:00.000Z',
      kind: 'SICK',
    });
    expect(result.success).toBe(false);
  });
});

describe('slotQuerySchema', () => {
  it('coerces the duration from a query string', () => {
    const result = slotQuerySchema.parse({ from: '2026-09-01', to: '2026-09-07', duration: '45' });
    expect(result.duration).toBe(45);
  });

  it('rejects a duration the studio does not sell', () => {
    const result = slotQuerySchema.safeParse({
      from: '2026-09-01',
      to: '2026-09-07',
      duration: '20',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a reversed range', () => {
    const result = slotQuerySchema.safeParse({
      from: '2026-09-07',
      to: '2026-09-01',
      duration: '60',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a range wider than two months', () => {
    const result = slotQuerySchema.safeParse({
      from: '2026-01-01',
      to: '2026-06-01',
      duration: '60',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a single day', () => {
    const result = slotQuerySchema.safeParse({
      from: '2026-09-01',
      to: '2026-09-01',
      duration: '30',
    });
    expect(result.success).toBe(true);
  });
});

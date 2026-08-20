import { describe, expect, it } from 'vitest';
import { bookingRequestSchema } from './booking';

const TEACHER_ID = '019880d3-0000-7000-8000-000000000001';
const LOCATION_ID = '019880d3-0000-7000-8000-000000000002';
const PLAN_ID = '019880d3-0000-7000-8000-000000000003';
const SUBSCRIPTION_ID = '019880d3-0000-7000-8000-000000000004';

function booking(overrides: Record<string, unknown> = {}) {
  return {
    teacherId: TEACHER_ID,
    locationId: LOCATION_ID,
    startsAt: '2026-09-01T14:00:00.000Z',
    kind: 'SINGLE',
    pricePlanId: PLAN_ID,
    ...overrides,
  };
}

describe('bookingRequestSchema', () => {
  it('accepts a single lesson booked against a plan', () => {
    expect(bookingRequestSchema.safeParse(booking()).success).toBe(true);
  });

  it('rejects a single lesson with no plan - the plan fixes the duration', () => {
    const result = bookingRequestSchema.safeParse(booking({ pricePlanId: undefined }));
    expect(result.success).toBe(false);
  });

  it('accepts a subscription lesson that names the package', () => {
    const result = bookingRequestSchema.safeParse(
      booking({ kind: 'SUBSCRIPTION', pricePlanId: undefined, subscriptionId: SUBSCRIPTION_ID }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects a subscription lesson with no package', () => {
    const result = bookingRequestSchema.safeParse(
      booking({ kind: 'SUBSCRIPTION', pricePlanId: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a group booking - group lessons come from the timetable', () => {
    expect(bookingRequestSchema.safeParse(booking({ kind: 'GROUP' })).success).toBe(false);
  });
});

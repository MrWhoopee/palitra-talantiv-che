import { describe, expect, it } from 'vitest';
import { subscriptionInputSchema } from './subscriptions';

const STUDENT_ID = '019880d3-0000-7000-8000-000000000001';
const TEACHER_ID = '019880d3-0000-7000-8000-000000000002';
const PLAN_ID = '019880d3-0000-7000-8000-000000000003';

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    studentId: STUDENT_ID,
    teacherId: TEACHER_ID,
    pricePlanId: PLAN_ID,
    validFrom: '2026-09-01',
    validTo: '2026-11-30',
    ...overrides,
  };
}

describe('subscriptionInputSchema', () => {
  it('accepts a package sold against a plan', () => {
    expect(subscriptionInputSchema.safeParse(subscription()).success).toBe(true);
  });

  it('accepts a package that is valid for a single day', () => {
    const result = subscriptionInputSchema.safeParse(subscription({ validTo: '2026-09-01' }));
    expect(result.success).toBe(true);
  });

  it('rejects a validity range that ends before it starts', () => {
    const result = subscriptionInputSchema.safeParse(subscription({ validTo: '2026-08-01' }));
    expect(result.success).toBe(false);
  });

  it('takes no lesson count or price - both come from the plan', () => {
    const parsed = subscriptionInputSchema.parse(
      subscription({ lessonsTotal: 99, priceUah: 1 }) as Record<string, unknown>,
    );
    expect(parsed).not.toHaveProperty('lessonsTotal');
    expect(parsed).not.toHaveProperty('priceUah');
  });
});

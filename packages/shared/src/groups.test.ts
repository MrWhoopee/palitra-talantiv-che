import { describe, expect, it } from 'vitest';
import { attendanceUpdateSchema, groupInputSchema } from './groups';

const DIRECTION_ID = '019880d3-0000-7000-8000-000000000001';
const LOCATION_ID = '019880d3-0000-7000-8000-000000000002';
const STUDENT_ID = '019880d3-0000-7000-8000-000000000003';

function group(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Вокальний ансамбль',
    directionId: DIRECTION_ID,
    locationId: LOCATION_ID,
    capacity: 8,
    durationMinutes: 60,
    startsOn: '2026-09-01',
    schedule: [{ weekday: 2, startTime: '17:00' }],
    ...overrides,
  };
}

describe('groupInputSchema', () => {
  it('accepts a group that meets once a week', () => {
    expect(groupInputSchema.safeParse(group()).success).toBe(true);
  });

  it('accepts an open-ended course', () => {
    expect(groupInputSchema.safeParse(group({ endsOn: null })).success).toBe(true);
  });

  it('rejects a course that ends before it starts', () => {
    const result = groupInputSchema.safeParse(group({ endsOn: '2026-08-01' }));
    expect(result.success).toBe(false);
  });

  it('rejects a duration the studio does not teach', () => {
    expect(groupInputSchema.safeParse(group({ durationMinutes: 50 })).success).toBe(false);
  });

  it('rejects a group of one - that is an individual lesson', () => {
    expect(groupInputSchema.safeParse(group({ capacity: 1 })).success).toBe(false);
  });

  it('rejects a group with no meetings at all', () => {
    expect(groupInputSchema.safeParse(group({ schedule: [] })).success).toBe(false);
  });

  it('rejects the same meeting listed twice', () => {
    const result = groupInputSchema.safeParse(
      group({
        schedule: [
          { weekday: 2, startTime: '17:00' },
          { weekday: 2, startTime: '17:00' },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts two meetings on the same day at different hours', () => {
    const result = groupInputSchema.safeParse(
      group({
        schedule: [
          { weekday: 2, startTime: '17:00' },
          { weekday: 2, startTime: '18:30' },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe('attendanceUpdateSchema', () => {
  it('accepts a register', () => {
    const result = attendanceUpdateSchema.safeParse({
      entries: [{ studentId: STUDENT_ID, status: 'PRESENT' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty register - nothing marked yet is a valid state', () => {
    expect(attendanceUpdateSchema.safeParse({ entries: [] }).success).toBe(true);
  });

  it('rejects a mark that is not one of the three', () => {
    const result = attendanceUpdateSchema.safeParse({
      entries: [{ studentId: STUDENT_ID, status: 'LATE' }],
    });
    expect(result.success).toBe(false);
  });
});

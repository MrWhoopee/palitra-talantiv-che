import { parseLocalDate, type LocalDate } from '@palitra/shared';
import { describe, expect, it } from 'vitest';
import { computeGroupLessons, type ComputeGroupLessonsInput } from './compute-group-lessons';

function on(value: string): LocalDate {
  const parsed = parseLocalDate(value);
  if (!parsed) {
    throw new Error(`Bad test date ${value}`);
  }
  return parsed;
}

function plan(overrides: Partial<ComputeGroupLessonsInput> = {}) {
  return computeGroupLessons({
    // Tuesdays at 17:00.
    schedule: [{ weekday: 2, startMinute: 17 * 60 }],
    startsOn: on('2026-09-01'),
    endsOn: on('2026-09-30'),
    durationMinutes: 60,
    from: new Date('2026-09-01T05:00:00.000Z'),
    horizonDays: 56,
    ...overrides,
  });
}

function times(lessons: { startsAt: Date }[]): string[] {
  return lessons.map((lesson) => lesson.startsAt.toISOString());
}

describe('computeGroupLessons', () => {
  it('generates one meeting per matching weekday inside the course', () => {
    // September 2026: Tuesdays fall on the 1st, 8th, 15th, 22nd and 29th.
    expect(times(plan())).toEqual([
      '2026-09-01T14:00:00.000Z',
      '2026-09-08T14:00:00.000Z',
      '2026-09-15T14:00:00.000Z',
      '2026-09-22T14:00:00.000Z',
      '2026-09-29T14:00:00.000Z',
    ]);
  });

  it('sets the end from the duration', () => {
    const [first] = plan({ durationMinutes: 45 });
    expect(first?.endsAt.toISOString()).toBe('2026-09-01T14:45:00.000Z');
  });

  it('keeps the local hour across the switch to winter time', () => {
    // Kyiv leaves summer time on 25 October 2026, so 17:00 is 14:00 UTC before
    // and 15:00 UTC after. A course that meets at five in the afternoon meets
    // at five in the afternoon on both sides of that night.
    const lessons = plan({
      startsOn: on('2026-10-20'),
      endsOn: on('2026-11-03'),
      from: new Date('2026-10-20T05:00:00.000Z'),
    });

    expect(times(lessons)).toEqual([
      '2026-10-20T14:00:00.000Z',
      '2026-10-27T15:00:00.000Z',
      '2026-11-03T15:00:00.000Z',
    ]);
  });

  it('skips a meeting that falls in the hour the clocks skip', () => {
    // Kyiv jumps from 03:00 to 04:00 on 29 March 2026, a Sunday. A group that
    // met at 03:30 that morning would meet at an hour that does not exist.
    const lessons = plan({
      schedule: [{ weekday: 0, startMinute: 3 * 60 + 30 }],
      startsOn: on('2026-03-22'),
      endsOn: on('2026-04-05'),
      from: new Date('2026-03-22T00:00:00.000Z'),
    });

    expect(times(lessons)).toEqual(['2026-03-22T01:30:00.000Z', '2026-04-05T00:30:00.000Z']);
  });

  it('generates every meeting of a group that meets twice a week', () => {
    const lessons = plan({
      schedule: [
        { weekday: 2, startMinute: 17 * 60 },
        { weekday: 4, startMinute: 18 * 60 },
      ],
      endsOn: on('2026-09-10'),
    });

    expect(times(lessons)).toEqual([
      '2026-09-01T14:00:00.000Z',
      '2026-09-03T15:00:00.000Z',
      '2026-09-08T14:00:00.000Z',
      '2026-09-10T15:00:00.000Z',
    ]);
  });

  it('does not regenerate a meeting earlier the same day', () => {
    // Asked at six in the evening, after the group has already met at five.
    const lessons = plan({ from: new Date('2026-09-01T15:00:00.000Z') });
    expect(times(lessons)[0]).toBe('2026-09-08T14:00:00.000Z');
  });

  it('starts from today rather than from the course start date', () => {
    const lessons = plan({ from: new Date('2026-09-16T05:00:00.000Z') });
    expect(times(lessons)).toEqual(['2026-09-22T14:00:00.000Z', '2026-09-29T14:00:00.000Z']);
  });

  it('waits for a course that has not begun yet', () => {
    const lessons = plan({
      startsOn: on('2026-09-15'),
      from: new Date('2026-09-01T05:00:00.000Z'),
    });
    expect(times(lessons)).toEqual([
      '2026-09-15T14:00:00.000Z',
      '2026-09-22T14:00:00.000Z',
      '2026-09-29T14:00:00.000Z',
    ]);
  });

  it('stops an open-ended course at the horizon', () => {
    const lessons = plan({ endsOn: null, horizonDays: 21 });
    expect(times(lessons)).toEqual([
      '2026-09-01T14:00:00.000Z',
      '2026-09-08T14:00:00.000Z',
      '2026-09-15T14:00:00.000Z',
      '2026-09-22T14:00:00.000Z',
    ]);
  });

  it('returns nothing for a course that has already finished', () => {
    expect(plan({ endsOn: on('2026-08-31') })).toEqual([]);
  });

  it('returns nothing when the group has no timetable', () => {
    expect(plan({ schedule: [] })).toEqual([]);
  });

  it('includes the last day of the course', () => {
    const lessons = plan({ endsOn: on('2026-09-08') });
    expect(times(lessons)).toEqual(['2026-09-01T14:00:00.000Z', '2026-09-08T14:00:00.000Z']);
  });

  it('never returns meetings out of order', () => {
    const lessons = plan({
      schedule: [
        { weekday: 4, startMinute: 18 * 60 },
        { weekday: 2, startMinute: 17 * 60 },
      ],
      endsOn: on('2026-09-10'),
    });

    const starts = lessons.map((lesson) => lesson.startsAt.getTime());
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });
});

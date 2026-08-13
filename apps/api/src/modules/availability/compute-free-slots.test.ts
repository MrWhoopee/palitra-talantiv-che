import {
  formatLocalDate,
  formatTimeOfDay,
  fromZonedTime,
  parseLocalDate,
  parseTimeOfDay,
  toLocalDate,
  toZonedParts,
  weekdayOf,
  type LocalDate,
} from '@palitra/shared';
import { describe, expect, it } from 'vitest';
import {
  computeFreeSlots,
  type AvailabilityWindowRule,
  type FreeSlot,
  type TimeInterval,
} from './compute-free-slots';

const BLAHOVISNA = 'location-blahovisna';
const SHEVCHENKA = 'location-shevchenka';

function date(value: string): LocalDate {
  const parsed = parseLocalDate(value);
  if (!parsed) {
    throw new Error(`Not a date: ${value}`);
  }
  return parsed;
}

/** A wall-clock moment in the studio's zone, written the way a person says it. */
function kyiv(day: string, time: string): Date {
  const minutes = parseTimeOfDay(time);
  if (minutes === null) {
    throw new Error(`Not a time: ${time}`);
  }
  return fromZonedTime(date(day), minutes);
}

function span(day: string, from: string, to: string): TimeInterval {
  return { startsAt: kyiv(day, from), endsAt: kyiv(day, to) };
}

/** The weekday comes from a sample date, so the rule and the tests cannot drift. */
function rule(
  sampleDay: string,
  from: string,
  to: string,
  overrides: Partial<AvailabilityWindowRule> = {},
): AvailabilityWindowRule {
  return {
    locationId: BLAHOVISNA,
    weekday: weekdayOf(date(sampleDay)),
    startMinute: parseTimeOfDay(from) ?? 0,
    endMinute: parseTimeOfDay(to) ?? 0,
    validFrom: date('2020-01-01'),
    validTo: null,
    ...overrides,
  };
}

/** Slots as a person reads them: `"2026-09-01 10:00"` in the studio's zone. */
function localTimes(slots: readonly FreeSlot[]): string[] {
  return slots.map(
    (slot) =>
      `${formatLocalDate(toLocalDate(slot.startsAt))} ${formatTimeOfDay(
        toZonedParts(slot.startsAt).minuteOfDay,
      )}`,
  );
}

function compute(input: {
  rules: AvailabilityWindowRule[];
  exceptions?: TimeInterval[];
  busyLessons?: TimeInterval[];
  from: string;
  to: string;
  durationMinutes?: number;
}): FreeSlot[] {
  return computeFreeSlots({
    rules: input.rules,
    exceptions: input.exceptions ?? [],
    busyLessons: input.busyLessons ?? [],
    range: { startsAt: kyiv(input.from, '00:00'), endsAt: kyiv(input.to, '00:00') },
    durationMinutes: input.durationMinutes ?? 60,
    stepMinutes: 15,
  });
}

describe('computeFreeSlots', () => {
  it('walks the grid from the start of the working window', () => {
    const slots = compute({
      rules: [rule('2026-09-01', '10:00', '12:00')],
      from: '2026-09-01',
      to: '2026-09-02',
    });

    expect(localTimes(slots)).toStrictEqual([
      '2026-09-01 10:00',
      '2026-09-01 10:15',
      '2026-09-01 10:30',
      '2026-09-01 10:45',
      '2026-09-01 11:00',
    ]);
  });

  it('offers more starts for a shorter lesson on the same window', () => {
    const window = [rule('2026-09-01', '10:00', '11:00')];

    expect(
      localTimes(
        compute({ rules: window, from: '2026-09-01', to: '2026-09-02', durationMinutes: 30 }),
      ),
    ).toStrictEqual(['2026-09-01 10:00', '2026-09-01 10:15', '2026-09-01 10:30']);

    expect(
      localTimes(
        compute({ rules: window, from: '2026-09-01', to: '2026-09-02', durationMinutes: 45 }),
      ),
    ).toStrictEqual(['2026-09-01 10:00', '2026-09-01 10:15']);

    expect(
      localTimes(
        compute({ rules: window, from: '2026-09-01', to: '2026-09-02', durationMinutes: 60 }),
      ),
    ).toStrictEqual(['2026-09-01 10:00']);
  });

  it('anchors the grid to the window, not to the hour', () => {
    const slots = compute({
      rules: [rule('2026-09-01', '09:50', '11:00')],
      from: '2026-09-01',
      to: '2026-09-02',
      durationMinutes: 30,
    });

    expect(localTimes(slots)).toStrictEqual([
      '2026-09-01 09:50',
      '2026-09-01 10:05',
      '2026-09-01 10:20',
    ]);
  });

  it('ignores rules for other weekdays', () => {
    const slots = compute({
      rules: [rule('2026-09-01', '10:00', '12:00')],
      from: '2026-09-02',
      to: '2026-09-03',
    });

    expect(slots).toStrictEqual([]);
  });

  it('repeats a rule every week inside the range', () => {
    const slots = compute({
      rules: [rule('2026-09-01', '10:00', '11:00')],
      from: '2026-09-01',
      to: '2026-09-16',
    });

    expect(localTimes(slots)).toStrictEqual([
      '2026-09-01 10:00',
      '2026-09-08 10:00',
      '2026-09-15 10:00',
    ]);
  });

  describe('daylight saving', () => {
    it('keeps a rule at the same local time on both sides of the spring change', () => {
      // Clocks go forward on 2026-03-29.
      const slots = compute({
        rules: [rule('2026-03-24', '17:00', '18:00')],
        from: '2026-03-24',
        to: '2026-04-01',
      });

      expect(localTimes(slots)).toStrictEqual(['2026-03-24 17:00', '2026-03-31 17:00']);
      // Same wall clock, one hour apart in UTC - which is the entire point.
      expect(slots[0]?.startsAt.toISOString()).toBe('2026-03-24T15:00:00.000Z');
      expect(slots[1]?.startsAt.toISOString()).toBe('2026-03-31T14:00:00.000Z');
    });

    it('keeps a rule at the same local time on both sides of the autumn change', () => {
      // Clocks go back on 2026-10-25.
      const slots = compute({
        rules: [rule('2026-10-20', '17:00', '18:00')],
        from: '2026-10-20',
        to: '2026-10-28',
      });

      expect(localTimes(slots)).toStrictEqual(['2026-10-20 17:00', '2026-10-27 17:00']);
      expect(slots[0]?.startsAt.toISOString()).toBe('2026-10-20T14:00:00.000Z');
      expect(slots[1]?.startsAt.toISOString()).toBe('2026-10-27T15:00:00.000Z');
    });

    it('loses the hour the spring gap swallows instead of inventing slots', () => {
      // A window of 02:00-05:00 on the transition night is only two real hours
      // long: 03:00 becomes 04:00.
      const slots = compute({
        rules: [rule('2026-03-29', '02:00', '05:00')],
        from: '2026-03-29',
        to: '2026-03-30',
        durationMinutes: 60,
      });

      const first = slots[0];
      const last = slots[slots.length - 1];
      expect(first && last && last.endsAt.getTime() - first.startsAt.getTime()).toBe(
        2 * 60 * 60 * 1000,
      );
      // Every slot is a full hour of real time, however the clock behaved.
      for (const slot of slots) {
        expect(slot.endsAt.getTime() - slot.startsAt.getTime()).toBe(60 * 60 * 1000);
      }
    });
  });

  describe('validity range', () => {
    it('skips a rule that has not started yet', () => {
      const slots = compute({
        rules: [rule('2026-09-01', '10:00', '11:00', { validFrom: date('2026-09-08') })],
        from: '2026-09-01',
        to: '2026-09-09',
      });

      expect(localTimes(slots)).toStrictEqual(['2026-09-08 10:00']);
    });

    it('skips a rule whose validTo is in the past', () => {
      const slots = compute({
        rules: [rule('2026-09-01', '10:00', '11:00', { validTo: date('2026-08-31') })],
        from: '2026-09-01',
        to: '2026-09-09',
      });

      expect(slots).toStrictEqual([]);
    });

    it('includes the last day of validity', () => {
      const slots = compute({
        rules: [rule('2026-09-01', '10:00', '11:00', { validTo: date('2026-09-01') })],
        from: '2026-09-01',
        to: '2026-09-09',
      });

      expect(localTimes(slots)).toStrictEqual(['2026-09-01 10:00']);
    });

    it('lets a replacement rule take over from a date', () => {
      const slots = compute({
        rules: [
          rule('2026-09-01', '10:00', '11:00', { validTo: date('2026-09-07') }),
          rule('2026-09-01', '15:00', '16:00', { validFrom: date('2026-09-08') }),
        ],
        from: '2026-09-01',
        to: '2026-09-16',
      });

      expect(localTimes(slots)).toStrictEqual([
        '2026-09-01 10:00',
        '2026-09-08 15:00',
        '2026-09-15 15:00',
      ]);
    });
  });

  describe('exceptions and busy lessons', () => {
    it('cuts a holiday out of the middle of a working day', () => {
      const slots = compute({
        rules: [rule('2026-09-01', '10:00', '14:00')],
        exceptions: [span('2026-09-01', '11:30', '13:00')],
        from: '2026-09-01',
        to: '2026-09-02',
      });

      expect(localTimes(slots)).toStrictEqual([
        '2026-09-01 10:00',
        '2026-09-01 10:15',
        '2026-09-01 10:30',
        '2026-09-01 13:00',
      ]);
    });

    it('drops a whole day covered by a multi-day holiday', () => {
      const slots = compute({
        rules: [rule('2026-09-01', '10:00', '11:00')],
        exceptions: [
          { startsAt: kyiv('2026-08-31', '00:00'), endsAt: kyiv('2026-09-09', '00:00') },
        ],
        from: '2026-09-01',
        to: '2026-09-16',
      });

      expect(localTimes(slots)).toStrictEqual(['2026-09-15 10:00']);
    });

    it('treats a booked lesson exactly like a holiday', () => {
      const slots = compute({
        rules: [rule('2026-09-01', '10:00', '12:00')],
        busyLessons: [span('2026-09-01', '10:00', '11:00')],
        from: '2026-09-01',
        to: '2026-09-02',
      });

      expect(localTimes(slots)).toStrictEqual(['2026-09-01 11:00']);
    });

    it('leaves the slot that begins the moment a lesson ends', () => {
      // Touching is not overlapping - otherwise every booking would silently
      // eat the hour after it as well.
      const slots = compute({
        rules: [rule('2026-09-01', '10:00', '12:00')],
        busyLessons: [span('2026-09-01', '11:00', '12:00')],
        from: '2026-09-01',
        to: '2026-09-02',
      });

      expect(localTimes(slots)).toStrictEqual(['2026-09-01 10:00']);
    });

    it('handles two lessons back to back with no gap between them', () => {
      const slots = compute({
        rules: [rule('2026-09-01', '10:00', '13:00')],
        busyLessons: [span('2026-09-01', '10:00', '11:00'), span('2026-09-01', '11:00', '12:00')],
        from: '2026-09-01',
        to: '2026-09-02',
      });

      expect(localTimes(slots)).toStrictEqual(['2026-09-01 12:00']);
    });

    it('keeps the grid on the quarter hour after an odd-length booking', () => {
      const slots = compute({
        rules: [rule('2026-09-01', '10:00', '12:00')],
        busyLessons: [span('2026-09-01', '10:00', '10:50')],
        from: '2026-09-01',
        to: '2026-09-02',
        durationMinutes: 30,
      });

      expect(localTimes(slots)).toStrictEqual([
        '2026-09-01 11:00',
        '2026-09-01 11:15',
        '2026-09-01 11:30',
      ]);
    });

    it('ignores an exception that ends before the range', () => {
      const slots = compute({
        rules: [rule('2026-09-01', '10:00', '11:00')],
        exceptions: [span('2026-08-25', '00:00', '23:00')],
        from: '2026-09-01',
        to: '2026-09-02',
      });

      expect(localTimes(slots)).toStrictEqual(['2026-09-01 10:00']);
    });
  });

  describe('range and locations', () => {
    it('never returns a slot that starts before the range', () => {
      const slots = computeFreeSlots({
        rules: [rule('2026-09-01', '10:00', '13:00')],
        exceptions: [],
        busyLessons: [],
        range: { startsAt: kyiv('2026-09-01', '11:20'), endsAt: kyiv('2026-09-02', '00:00') },
        durationMinutes: 60,
        stepMinutes: 15,
      });

      expect(localTimes(slots)).toStrictEqual([
        '2026-09-01 11:30',
        '2026-09-01 11:45',
        '2026-09-01 12:00',
      ]);
    });

    it('never returns a slot that ends after the range', () => {
      const slots = computeFreeSlots({
        rules: [rule('2026-09-01', '10:00', '13:00')],
        exceptions: [],
        busyLessons: [],
        range: { startsAt: kyiv('2026-09-01', '00:00'), endsAt: kyiv('2026-09-01', '12:00') },
        durationMinutes: 60,
        stepMinutes: 15,
      });

      expect(localTimes(slots).at(-1)).toBe('2026-09-01 11:00');
    });

    it('keeps the same hour at two addresses apart', () => {
      const slots = compute({
        rules: [
          rule('2026-09-01', '10:00', '11:00'),
          rule('2026-09-01', '10:00', '11:00', { locationId: SHEVCHENKA }),
        ],
        from: '2026-09-01',
        to: '2026-09-02',
      });

      expect(slots).toHaveLength(2);
      expect(slots.map((slot) => slot.locationId).sort()).toStrictEqual(
        [BLAHOVISNA, SHEVCHENKA].sort(),
      );
    });

    it('offers an overlapping pair of rules at one address only once', () => {
      const slots = compute({
        rules: [rule('2026-09-01', '10:00', '12:00'), rule('2026-09-01', '11:00', '13:00')],
        from: '2026-09-01',
        to: '2026-09-02',
      });

      expect(localTimes(slots)).toStrictEqual([
        '2026-09-01 10:00',
        '2026-09-01 10:15',
        '2026-09-01 10:30',
        '2026-09-01 10:45',
        '2026-09-01 11:00',
        '2026-09-01 11:15',
        '2026-09-01 11:30',
        '2026-09-01 11:45',
        '2026-09-01 12:00',
      ]);
    });

    it('returns nothing for a reversed or empty range', () => {
      const rules = [rule('2026-09-01', '10:00', '12:00')];
      expect(compute({ rules, from: '2026-09-02', to: '2026-09-01' })).toStrictEqual([]);
      expect(compute({ rules, from: '2026-09-01', to: '2026-09-01' })).toStrictEqual([]);
    });

    it('returns nothing when there are no rules', () => {
      expect(compute({ rules: [], from: '2026-09-01', to: '2026-09-30' })).toStrictEqual([]);
    });
  });
});

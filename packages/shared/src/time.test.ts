import { describe, expect, it } from 'vitest';
import {
  addLocalDays,
  compareLocalDates,
  eachLocalDate,
  formatLocalDate,
  formatTimeOfDay,
  fromZonedTime,
  parseLocalDate,
  parseTimeOfDay,
  toLocalDate,
  toZonedParts,
  weekdayOf,
  zoneOffsetMinutes,
} from './time';

describe('zoneOffsetMinutes', () => {
  it('is +2 hours in Kyiv winter and +3 in summer', () => {
    expect(zoneOffsetMinutes(new Date('2026-01-15T12:00:00Z'))).toBe(120);
    expect(zoneOffsetMinutes(new Date('2026-07-15T12:00:00Z'))).toBe(180);
  });
});

describe('fromZonedTime', () => {
  it('keeps a local time of day fixed across the spring transition', () => {
    // Clocks go forward on the last Sunday of March 2026 (the 29th).
    const before = fromZonedTime({ year: 2026, month: 3, day: 24 }, 17 * 60);
    const after = fromZonedTime({ year: 2026, month: 3, day: 31 }, 17 * 60);

    expect(before.toISOString()).toBe('2026-03-24T15:00:00.000Z');
    expect(after.toISOString()).toBe('2026-03-31T14:00:00.000Z');
  });

  it('keeps a local time of day fixed across the autumn transition', () => {
    // Clocks go back on the last Sunday of October 2026 (the 25th).
    const before = fromZonedTime({ year: 2026, month: 10, day: 20 }, 17 * 60);
    const after = fromZonedTime({ year: 2026, month: 10, day: 27 }, 17 * 60);

    expect(before.toISOString()).toBe('2026-10-20T14:00:00.000Z');
    expect(after.toISOString()).toBe('2026-10-27T15:00:00.000Z');
  });

  it('resolves a local time that the spring gap skips to the moment the clock jumps to', () => {
    // 03:30 never happens on 2026-03-29: 03:00 becomes 04:00.
    const inTheGap = fromZonedTime({ year: 2026, month: 3, day: 29 }, 3 * 60 + 30);
    expect(inTheGap.toISOString()).toBe('2026-03-29T01:30:00.000Z');
    expect(toZonedParts(inTheGap).minuteOfDay).toBe(4 * 60 + 30);
  });

  it('resolves a local time the autumn overlap repeats to the later occurrence', () => {
    // 03:30 happens twice on 2026-10-25; taking the second one keeps a window
    // written as 03:00-07:00 four hours long instead of five.
    const ambiguous = fromZonedTime({ year: 2026, month: 10, day: 25 }, 3 * 60 + 30);
    expect(ambiguous.toISOString()).toBe('2026-10-25T01:30:00.000Z');

    const start = fromZonedTime({ year: 2026, month: 10, day: 25 }, 3 * 60);
    const end = fromZonedTime({ year: 2026, month: 10, day: 25 }, 7 * 60);
    expect(end.getTime() - start.getTime()).toBe(4 * 60 * 60 * 1000);
  });

  it('round-trips every hour of both transition days', () => {
    for (const day of [29, 30]) {
      for (let hour = 0; hour < 24; hour += 1) {
        const instant = fromZonedTime({ year: 2026, month: 3, day }, hour * 60);
        // The instant must land on the day it was asked for, whatever the
        // clocks did - a slot must never leak into a neighbouring date.
        expect(formatLocalDate(toLocalDate(instant))).toBe(`2026-03-${day}`);
      }
    }
  });

  it('is monotonic across the spring gap', () => {
    const times = [2, 3, 4, 5].map((hour) =>
      fromZonedTime({ year: 2026, month: 3, day: 29 }, hour * 60).getTime(),
    );
    expect(times).toStrictEqual([...times].sort((a, b) => a - b));
  });
});

describe('toZonedParts', () => {
  it('reads the local calendar day, not the UTC one', () => {
    // 22:30 UTC is already the next day in Kyiv.
    const parts = toZonedParts(new Date('2026-07-14T22:30:00Z'));
    expect(parts).toStrictEqual({
      year: 2026,
      month: 7,
      day: 15,
      weekday: 3,
      minuteOfDay: 90,
    });
  });
});

describe('weekdayOf', () => {
  it('numbers Sunday as 0', () => {
    expect(weekdayOf({ year: 2026, month: 8, day: 16 })).toBe(0);
    expect(weekdayOf({ year: 2026, month: 8, day: 17 })).toBe(1);
  });
});

describe('local date helpers', () => {
  it('adds days across a month boundary', () => {
    expect(addLocalDays({ year: 2026, month: 1, day: 30 }, 3)).toStrictEqual({
      year: 2026,
      month: 2,
      day: 2,
    });
  });

  it('orders dates', () => {
    const earlier = { year: 2026, month: 3, day: 1 };
    const later = { year: 2026, month: 3, day: 2 };
    expect(compareLocalDates(earlier, later)).toBeLessThan(0);
    expect(compareLocalDates(later, earlier)).toBeGreaterThan(0);
    expect(compareLocalDates(earlier, earlier)).toBe(0);
  });

  it('walks a range inclusively', () => {
    const days = eachLocalDate({ year: 2026, month: 2, day: 27 }, { year: 2026, month: 3, day: 1 });
    expect(days.map(formatLocalDate)).toStrictEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
  });

  it('returns nothing for a reversed range', () => {
    expect(
      eachLocalDate({ year: 2026, month: 3, day: 2 }, { year: 2026, month: 3, day: 1 }),
    ).toStrictEqual([]);
  });

  it('parses and rejects calendar dates', () => {
    expect(parseLocalDate('2026-08-13')).toStrictEqual({ year: 2026, month: 8, day: 13 });
    expect(parseLocalDate('2026-02-31')).toBeNull();
    expect(parseLocalDate('2026-8-13')).toBeNull();
    expect(parseLocalDate('not a date')).toBeNull();
  });
});

describe('time of day', () => {
  it('parses and formats wall-clock times', () => {
    expect(parseTimeOfDay('09:05')).toBe(545);
    expect(formatTimeOfDay(545)).toBe('09:05');
    expect(parseTimeOfDay('24:00')).toBeNull();
    expect(parseTimeOfDay('9:05')).toBeNull();
  });
});

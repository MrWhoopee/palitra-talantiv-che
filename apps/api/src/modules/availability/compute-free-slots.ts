import {
  compareLocalDates,
  eachLocalDate,
  fromZonedTime,
  STUDIO_TIME_ZONE,
  toLocalDate,
  weekdayOf,
  type LocalDate,
} from '@palitra/shared';

/**
 * The hardest question in the project - "which slots are free for teacher X" -
 * answered by a function with no database, no clock and no `req`.
 *
 * Everything it knows arrives as arguments, so the calendar arithmetic that
 * actually breaks in practice (the two nights the clocks move, a holiday
 * covering half a working day, two lessons back to back) is covered by table
 * tests that need neither a database nor a mock. Those are the bugs that are
 * both the most expensive and the quietest: nobody notices a schedule that is
 * an hour off until two families arrive for the same hour.
 */

export interface AvailabilityWindowRule {
  locationId: string;
  /** 0 = Sunday. */
  weekday: number;
  /** Minutes since local midnight. */
  startMinute: number;
  endMinute: number;
  validFrom: LocalDate;
  validTo: LocalDate | null;
}

export interface TimeInterval {
  startsAt: Date;
  endsAt: Date;
}

export interface ComputeFreeSlotsInput {
  rules: readonly AvailabilityWindowRule[];
  /** Holidays, sick days, blocked afternoons. */
  exceptions: readonly TimeInterval[];
  /** Lessons already holding the teacher's time - PENDING and CONFIRMED ones. */
  busyLessons: readonly TimeInterval[];
  range: TimeInterval;
  durationMinutes: number;
  /** The grid the studio offers starts on - 15 minutes, from the design doc. */
  stepMinutes: number;
  timeZone?: string;
}

export interface FreeSlot extends TimeInterval {
  locationId: string;
}

export function computeFreeSlots({
  rules,
  exceptions,
  busyLessons,
  range,
  durationMinutes,
  stepMinutes,
  timeZone = STUDIO_TIME_ZONE,
}: ComputeFreeSlotsInput): FreeSlot[] {
  if (durationMinutes <= 0 || stepMinutes <= 0 || range.endsAt <= range.startsAt) {
    return [];
  }

  const blocked = mergeIntervals([...exceptions, ...busyLessons]);
  const found = new Map<string, FreeSlot>();

  const days = eachLocalDate(
    toLocalDate(range.startsAt, timeZone),
    toLocalDate(range.endsAt, timeZone),
  );

  for (const day of days) {
    const weekday = weekdayOf(day);

    for (const rule of rules) {
      if (rule.weekday !== weekday || !ruleAppliesOn(rule, day)) {
        continue;
      }

      const windowStart = fromZonedTime(day, rule.startMinute, timeZone);
      const windowEnd = fromZonedTime(day, rule.endMinute, timeZone);
      // A window can collapse on the night the clocks go forward, when the
      // hour it covers does not exist.
      if (windowEnd <= windowStart) {
        continue;
      }

      // The grid is anchored to the start of the window rather than to the
      // hour: a rule that opens at 09:50 offers 09:50, 10:05, ... And it stays
      // anchored there after a lesson is cut out of the middle, so a booking
      // ending at 10:20 does not drag the rest of the day off the quarter-hour.
      for (let offset = 0; ; offset += stepMinutes) {
        const startsAt = new Date(windowStart.getTime() + offset * 60_000);
        const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

        if (endsAt > windowEnd || endsAt > range.endsAt) {
          break;
        }
        if (startsAt < range.startsAt || overlapsBlocked(blocked, startsAt, endsAt)) {
          continue;
        }

        // Two rules may cover the same hour at the same address - offering
        // that slot twice would be a display bug, not a second opening.
        const key = `${startsAt.getTime()}|${rule.locationId}`;
        if (!found.has(key)) {
          found.set(key, { startsAt, endsAt, locationId: rule.locationId });
        }
      }
    }
  }

  return [...found.values()].sort(
    (a, b) =>
      a.startsAt.getTime() - b.startsAt.getTime() || a.locationId.localeCompare(b.locationId),
  );
}

function ruleAppliesOn(rule: AvailabilityWindowRule, day: LocalDate): boolean {
  if (compareLocalDates(day, rule.validFrom) < 0) {
    return false;
  }
  return rule.validTo === null || compareLocalDates(day, rule.validTo) <= 0;
}

/**
 * Sorted and coalesced once per call, so the overlap check below can stop at
 * the first interval that starts after the candidate ends.
 */
function mergeIntervals(intervals: readonly TimeInterval[]): TimeInterval[] {
  const sorted = intervals
    .filter((interval) => interval.endsAt > interval.startsAt)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const merged: TimeInterval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.startsAt.getTime() <= last.endsAt.getTime()) {
      if (interval.endsAt > last.endsAt) {
        last.endsAt = interval.endsAt;
      }
      continue;
    }
    merged.push({ startsAt: interval.startsAt, endsAt: interval.endsAt });
  }
  return merged;
}

/**
 * Touching is not overlapping: a lesson that ends at 11:00 leaves 11:00 free.
 * Without that, every booking would quietly eat the slot after it.
 */
function overlapsBlocked(blocked: readonly TimeInterval[], startsAt: Date, endsAt: Date): boolean {
  for (const interval of blocked) {
    if (interval.startsAt >= endsAt) {
      return false;
    }
    if (interval.endsAt > startsAt) {
      return true;
    }
  }
  return false;
}

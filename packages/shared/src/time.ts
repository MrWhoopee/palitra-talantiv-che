/**
 * Calendar arithmetic for the studio's time zone, with no dependencies and no
 * hidden clock: every function takes what it needs as an argument.
 *
 * Everything is stored in UTC, but a working rule like "every Tuesday 17:00"
 * is a *local* time of day. On the night the clocks change, 17:00 in Kyiv is a
 * different instant before and after - so the conversion has to happen against
 * the zone, not against a fixed offset.
 */

export const STUDIO_TIME_ZONE = 'Europe/Kyiv';

export const MINUTES_PER_DAY = 24 * 60;

/** A date on the wall calendar, with no time and no zone of its own. */
export interface LocalDate {
  year: number;
  /** 1-12, as people write it. */
  month: number;
  day: number;
}

export interface ZonedParts extends LocalDate {
  /** 0 = Sunday, matching `Date.prototype.getUTCDay`. */
  weekday: number;
  /** Minutes since local midnight. */
  minuteOfDay: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

interface WallClock extends LocalDate {
  hour: number;
  minute: number;
  second: number;
}

function wallClockOf(instant: Date, timeZone: string): WallClock {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type);
    return part ? Number(part.value) : 0;
  };

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

/**
 * How far the zone is ahead of UTC at that instant, in minutes (+120 for Kyiv
 * summer time, +180 for... the other way round: Kyiv is UTC+2 in winter and
 * UTC+3 in summer).
 */
export function zoneOffsetMinutes(instant: Date, timeZone: string = STUDIO_TIME_ZONE): number {
  const wall = wallClockOf(instant, timeZone);
  const asIfUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  // Truncated to whole seconds on both sides: zone offsets are whole minutes,
  // so the milliseconds would only add rounding noise.
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return (asIfUtc - truncated) / 60_000;
}

/** The wall-calendar view of an instant: date, weekday and minutes since midnight. */
export function toZonedParts(instant: Date, timeZone: string = STUDIO_TIME_ZONE): ZonedParts {
  const wall = wallClockOf(instant, timeZone);
  return {
    year: wall.year,
    month: wall.month,
    day: wall.day,
    weekday: weekdayOf(wall),
    minuteOfDay: wall.hour * 60 + wall.minute,
  };
}

/**
 * The instant at which the given wall-clock time occurs in the zone.
 *
 * Two passes, because the offset needed to do the conversion is itself a
 * function of the answer: the first pass reads the offset in force at the
 * naive timestamp, the second re-reads it at the corrected one. That second
 * read is what gets the hours right on the two nights a year the clocks move.
 *
 * On those nights some local times are not real: 03:30 does not exist in the
 * spring gap, and 03:30 happens twice in the autumn overlap. A gap time lands
 * on the instant the clock jumps to; an overlapping one resolves to the second
 * of the two, on standard time. The second choice is the useful one: a window
 * written as 03:00-07:00 then lasts the four hours it says, instead of
 * silently gaining the repeated hour.
 */
export function fromZonedTime(
  date: LocalDate,
  minuteOfDay: number,
  timeZone: string = STUDIO_TIME_ZONE,
): Date {
  const naive = Date.UTC(date.year, date.month - 1, date.day) + minuteOfDay * 60_000;
  const firstPass = naive - zoneOffsetMinutes(new Date(naive), timeZone) * 60_000;
  const secondPass = naive - zoneOffsetMinutes(new Date(firstPass), timeZone) * 60_000;
  return new Date(secondPass);
}

export function weekdayOf(date: LocalDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

export function addLocalDays(date: LocalDate, days: number): LocalDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Negative when `a` is earlier, matching the contract of `Array.prototype.sort`. */
export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day);
}

/** Every calendar day from `from` to `to`, both ends included. */
export function eachLocalDate(from: LocalDate, to: LocalDate): LocalDate[] {
  const days: LocalDate[] = [];
  for (
    let current = from;
    compareLocalDates(current, to) <= 0;
    current = addLocalDays(current, 1)
  ) {
    days.push(current);
    // A malformed range must not spin forever; four years is far past any
    // window the interface can ask for.
    if (days.length > 1500) {
      break;
    }
  }
  return days;
}

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseLocalDate(value: string): LocalDate | null {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = { year, month, day };
  // Rejects 2026-02-31: `Date.UTC` rolls it over to March, so a round trip
  // through the calendar is what proves the day exists.
  return formatLocalDate(date) === value ? date : null;
}

export function formatLocalDate(date: LocalDate): string {
  const rolled = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const year = String(rolled.getUTCFullYear()).padStart(4, '0');
  const month = String(rolled.getUTCMonth() + 1).padStart(2, '0');
  const day = String(rolled.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The calendar date an instant falls on in the zone. */
export function toLocalDate(instant: Date, timeZone: string = STUDIO_TIME_ZONE): LocalDate {
  const { year, month, day } = toZonedParts(instant, timeZone);
  return { year, month, day };
}

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `"17:30"` -> 1050. Returns null for anything that is not a wall-clock time. */
export function parseTimeOfDay(value: string): number | null {
  const match = TIME_OF_DAY_PATTERN.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** 1050 -> `"17:30"`. */
export function formatTimeOfDay(minuteOfDay: number): string {
  const hours = String(Math.floor(minuteOfDay / 60)).padStart(2, '0');
  const minutes = String(minuteOfDay % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

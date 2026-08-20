import {
  addLocalDays,
  formatLocalDate,
  formatTimeOfDay,
  parseLocalDate,
  toLocalDate,
  toZonedParts,
  type LocalDate,
} from '@palitra/shared';

/**
 * Every date on the site is rendered in the studio's zone, never in the
 * server's. A page built on a machine set to UTC and one built on a laptop in
 * Kyiv have to show the same lesson at the same hour, so the formatting goes
 * through the shared helpers rather than through `toLocaleString`.
 */

const WEEKDAYS = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', "п'ятниця", 'субота'];

/**
 * Indexed by the weekday numbering the API uses, 0 = Sunday. It lives in this
 * plain module rather than beside the form that offers the choices: a value
 * exported from a `'use client'` file reaches a server component as a client
 * reference, not as the array - `WEEKDAY_LABELS[2]` would silently be
 * `undefined` and the schedule would list rules with no day on them.
 */
export const WEEKDAY_LABELS = [
  'Неділя',
  'Понеділок',
  'Вівторок',
  'Середа',
  'Четвер',
  "П'ятниця",
  'Субота',
];

const WEEKDAYS_SHORT = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const MONTHS = [
  'січня',
  'лютого',
  'березня',
  'квітня',
  'травня',
  'червня',
  'липня',
  'серпня',
  'вересня',
  'жовтня',
  'листопада',
  'грудня',
];

export function today(): LocalDate {
  return toLocalDate(new Date());
}

export function toDateKey(instant: Date): string {
  return formatLocalDate(toLocalDate(instant));
}

/** `"14:30"` in Kyiv. */
export function timeOf(instant: Date): string {
  return formatTimeOfDay(toZonedParts(instant).minuteOfDay);
}

/** `"четвер, 13 серпня"`. */
export function longDate(date: LocalDate): string {
  const weekday = WEEKDAYS[weekdayIndex(date)] ?? '';
  return `${weekday}, ${date.day} ${MONTHS[date.month - 1] ?? ''}`;
}

/** `"чт 13.08"`, for a column heading that has to stay narrow. */
export function shortDate(date: LocalDate): string {
  const weekday = WEEKDAYS_SHORT[weekdayIndex(date)] ?? '';
  return `${weekday} ${String(date.day).padStart(2, '0')}.${String(date.month).padStart(2, '0')}`;
}

/** `"13 серпня, 14:30"` - how a lesson is written in a list. */
export function lessonMoment(instant: Date): string {
  const date = toLocalDate(instant);
  return `${date.day} ${MONTHS[date.month - 1] ?? ''}, ${timeOf(instant)}`;
}

/**
 * `"13 серпня 2026, 18:00"` - an event, which unlike a lesson can be far
 * enough away that the year stops being obvious.
 */
export function formatEventDate(iso: string): string {
  const instant = new Date(iso);
  const date = toLocalDate(instant);
  return `${date.day} ${MONTHS[date.month - 1] ?? ''} ${date.year}, ${timeOf(instant)}`;
}

/**
 * `"13 вересня 2026, 18:00 – 20:00"`, and the same without the tail when the
 * studio has not said when the event ends. A concert that runs past midnight
 * gets both dates written out, because "18:00 – 01:00" on one date is a lie.
 */
export function formatEventRange(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const opening = formatEventDate(startsAt);

  if (endsAt === null) {
    return opening;
  }

  const end = new Date(endsAt);
  const sameDay = toDateKey(start) === toDateKey(end);

  return sameDay ? `${opening} – ${timeOf(end)}` : `${opening} – ${formatEventDate(endsAt)}`;
}

export function fromDateKey(value: string): LocalDate {
  return parseLocalDate(value) ?? today();
}

export function shiftDays(date: LocalDate, days: number): LocalDate {
  return addLocalDays(date, days);
}

export function dateKey(date: LocalDate): string {
  return formatLocalDate(date);
}

function weekdayIndex(date: LocalDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

/** `"Середа 17:00, п'ятниця 18:30"` - a group's week in one line. */
export function describeGroupSchedule(
  schedule: readonly { weekday: number; startTime: string }[],
): string {
  if (schedule.length === 0) {
    return 'Розклад ще не складено';
  }

  return schedule
    .map((entry, index) => {
      const day = WEEKDAY_LABELS[entry.weekday] ?? '';
      return `${index === 0 ? day : day.toLowerCase()} ${entry.startTime}`;
    })
    .join(', ');
}

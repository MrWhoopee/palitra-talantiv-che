import {
  addLocalDays,
  compareLocalDates,
  eachLocalDate,
  fromZonedTime,
  STUDIO_TIME_ZONE,
  toLocalDate,
  toZonedParts,
  weekdayOf,
  type LocalDate,
} from '@palitra/shared';

/**
 * Turns a group's timetable into the actual meetings it means.
 *
 * `GroupSchedule` says "Tuesdays and Thursdays at 17:00", which is an
 * intention, not a calendar: only real `Lesson` rows can block the teacher's
 * individual slots and give attendance something to hang on. This is the
 * function that converts one into the other, and like `computeFreeSlots` it
 * takes everything it knows as arguments - no database, no clock - so the
 * awkward parts (a course that starts mid-week, the two nights the clocks
 * move, an open-ended course) are covered by table tests.
 */

export interface GroupMeeting {
  /** 0 = Sunday. */
  weekday: number;
  /** Minutes since local midnight. */
  startMinute: number;
}

export interface ComputeGroupLessonsInput {
  schedule: readonly GroupMeeting[];
  startsOn: LocalDate;
  /** `null` means an open-ended course, generated up to the horizon. */
  endsOn: LocalDate | null;
  durationMinutes: number;
  /** Nothing is generated before this instant - the past is history. */
  from: Date;
  /** How far ahead to go when the course has no end date. */
  horizonDays: number;
  timeZone?: string;
}

export interface PlannedLesson {
  startsAt: Date;
  endsAt: Date;
}

export function computeGroupLessons({
  schedule,
  startsOn,
  endsOn,
  durationMinutes,
  from,
  horizonDays,
  timeZone = STUDIO_TIME_ZONE,
}: ComputeGroupLessonsInput): PlannedLesson[] {
  if (schedule.length === 0 || durationMinutes <= 0 || horizonDays <= 0) {
    return [];
  }

  const today = toLocalDate(from, timeZone);
  // A course that began in the spring does not regenerate its spring: the
  // window opens at whichever is later, the course's first day or today.
  const firstDay = compareLocalDates(startsOn, today) > 0 ? startsOn : today;
  const horizon = addLocalDays(today, horizonDays);
  const lastDay = endsOn && compareLocalDates(endsOn, horizon) < 0 ? endsOn : horizon;

  if (compareLocalDates(firstDay, lastDay) > 0) {
    return [];
  }

  const planned: PlannedLesson[] = [];

  for (const day of eachLocalDate(firstDay, lastDay)) {
    const weekday = weekdayOf(day);

    for (const meeting of schedule) {
      if (meeting.weekday !== weekday) {
        continue;
      }

      const startsAt = fromZonedTime(day, meeting.startMinute, timeZone);

      // On the night the clocks go forward an hour of local time does not
      // exist. Asking for 03:30 that morning gives back some other minute, and
      // a meeting nobody can attend is better skipped than silently moved.
      if (toZonedParts(startsAt, timeZone).minuteOfDay !== meeting.startMinute) {
        continue;
      }

      // A meeting earlier today has already happened; regenerating it would
      // create a duplicate of a lesson that may already have a register.
      if (startsAt < from) {
        continue;
      }

      planned.push({
        startsAt,
        endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000),
      });
    }
  }

  return planned.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

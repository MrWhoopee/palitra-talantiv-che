import { z } from 'zod';
import {
  LESSON_DURATIONS,
  localDateSchema,
  timeOfDaySchema,
  weekdaySchema,
  type LessonDuration,
} from './availability';
import { directionSchema, locationSchema } from './teachers';
import { compareLocalDates, parseLocalDate } from './time';

/**
 * A place is held from the moment the application arrives, not from the moment
 * it is approved: a group of eight with five pending applications has three
 * places left, otherwise the studio approves nine people into eight chairs.
 */
export const GROUP_ENROLLMENT_STATUSES = ['PENDING', 'ACTIVE', 'LEFT'] as const;

export type GroupEnrollmentStatus = (typeof GROUP_ENROLLMENT_STATUSES)[number];

/** The statuses that still occupy a place - see the note above. */
export const OCCUPYING_ENROLLMENT_STATUSES = ['PENDING', 'ACTIVE'] as const;

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'EXCUSED'] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/**
 * When the group meets, in the studio's local time - the same shape as an
 * availability rule and for the same reason: "Tuesdays at 17:00" has to stay
 * 17:00 in Kyiv on both sides of a daylight-saving change.
 */
export const groupScheduleSchema = z.object({
  weekday: weekdaySchema,
  startTime: timeOfDaySchema,
});

export type GroupScheduleEntry = z.infer<typeof groupScheduleSchema>;

const teacherSummarySchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
});

export const groupSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  teacher: teacherSummarySchema,
  direction: directionSchema,
  location: locationSchema,
  capacity: z.number().int().positive(),
  durationMinutes: z.number().int().positive(),
  isOpenForEnrollment: z.boolean(),
  startsOn: localDateSchema,
  endsOn: localDateSchema.nullable(),
  schedule: z.array(groupScheduleSchema),
  /** Pending and active applications together, i.e. places held. */
  seatsTaken: z.number().int().nonnegative(),
  seatsLeft: z.number().int(),
});

export type Group = z.infer<typeof groupSchema>;

export const groupListSchema = z.array(groupSchema);

export const MAX_GROUP_CAPACITY = 20;

export const groupInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    /** Admins run groups for other people; a teacher's own id is implied. */
    teacherId: z.uuid().optional(),
    directionId: z.uuid(),
    locationId: z.uuid(),
    capacity: z.number().int().min(2).max(MAX_GROUP_CAPACITY),
    durationMinutes: z
      .number()
      .int()
      .refine((value): value is LessonDuration => LESSON_DURATIONS.includes(value as LessonDuration), {
        message: 'Тривалість заняття може бути 30, 45 або 60 хвилин',
      }),
    isOpenForEnrollment: z.boolean().optional(),
    startsOn: localDateSchema,
    endsOn: localDateSchema.nullable().optional(),
    schedule: z.array(groupScheduleSchema).min(1).max(7),
  })
  .superRefine((input, ctx) => {
    const from = parseLocalDate(input.startsOn);
    const to = input.endsOn ? parseLocalDate(input.endsOn) : null;

    if (from && to && compareLocalDates(to, from) < 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsOn'],
        message: 'Кінець курсу має бути не раніше за початок',
      });
    }

    const days = new Set(input.schedule.map((entry) => `${entry.weekday}|${entry.startTime}`));
    if (days.size !== input.schedule.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['schedule'],
        message: 'Одне й те саме заняття вказано двічі',
      });
    }
  });

export type GroupInput = z.infer<typeof groupInputSchema>;

export const groupEnrollmentSchema = z.object({
  id: z.uuid(),
  groupId: z.uuid(),
  student: z.object({
    id: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string(),
  }),
  status: z.enum(GROUP_ENROLLMENT_STATUSES),
  joinedAt: z.iso.datetime(),
  leftAt: z.iso.datetime().nullable(),
});

export type GroupEnrollment = z.infer<typeof groupEnrollmentSchema>;

export const groupEnrollmentListSchema = z.array(groupEnrollmentSchema);

/**
 * The register for one group lesson: every active member, with the mark if one
 * has been made. Absent marks are `null` rather than missing rows, so the
 * screen shows the whole group and the teacher cannot silently skip a child.
 */
export const attendanceEntrySchema = z.object({
  student: z.object({
    id: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string(),
  }),
  status: z.enum(ATTENDANCE_STATUSES).nullable(),
});

export type AttendanceEntry = z.infer<typeof attendanceEntrySchema>;

export const lessonAttendanceSchema = z.object({
  lessonId: z.uuid(),
  groupId: z.uuid(),
  groupName: z.string(),
  startsAt: z.iso.datetime(),
  entries: z.array(attendanceEntrySchema),
});

export type LessonAttendance = z.infer<typeof lessonAttendanceSchema>;

export const attendanceUpdateSchema = z.object({
  entries: z
    .array(z.object({ studentId: z.uuid(), status: z.enum(ATTENDANCE_STATUSES) }))
    .max(MAX_GROUP_CAPACITY),
});

export type AttendanceUpdate = z.infer<typeof attendanceUpdateSchema>;

/**
 * Saving a group generates its meetings, and some of them may not fit: the
 * teacher can already have an individual lesson at that hour. The result says
 * so out loud rather than silently leaving a hole in the timetable - the
 * studio has to know which Tuesday is missing.
 */
export const groupSaveResultSchema = z.object({
  group: groupSchema,
  generatedLessons: z.number().int().nonnegative(),
  skippedOccurrences: z.array(z.iso.datetime()),
});

export type GroupSaveResult = z.infer<typeof groupSaveResultSchema>;

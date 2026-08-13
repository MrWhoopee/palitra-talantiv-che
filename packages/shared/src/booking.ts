import { z } from 'zod';
import { LESSON_DURATIONS } from './availability';

export const LESSON_FORMATS = ['INDIVIDUAL', 'GROUP'] as const;

export type LessonFormat = (typeof LESSON_FORMATS)[number];

/**
 * A trial is free and one per student ever; a single lesson is paid outside
 * the system; a subscription lesson is drawn from a package. Stage 3 books the
 * first two - the third arrives with `Subscription` in stage 4.
 */
export const LESSON_KINDS = ['TRIAL', 'SINGLE', 'SUBSCRIPTION'] as const;

export type LessonKind = (typeof LESSON_KINDS)[number];

export const BOOKABLE_LESSON_KINDS = ['TRIAL', 'SINGLE'] as const;

export const LESSON_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const pricePlanSchema = z.object({
  id: z.uuid(),
  directionId: z.uuid(),
  directionName: z.string(),
  name: z.string(),
  lessonsCount: z.number().int().positive(),
  durationMinutes: z.number().int().positive(),
  format: z.enum(LESSON_FORMATS),
  priceUah: z.number().int().nonnegative(),
});

export type PricePlan = z.infer<typeof pricePlanSchema>;

const personSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
});

/**
 * A lesson as it is shown in a cabinet. The student's phone is included
 * because the teacher needs it and the endpoint only ever returns lessons the
 * caller is a party to - a student sees their own, a teacher sees theirs.
 */
export const lessonSchema = z.object({
  id: z.uuid(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  durationMinutes: z.number().int().positive(),
  kind: z.enum(LESSON_KINDS),
  status: z.enum(LESSON_STATUSES),
  cancelReason: z.string().nullable(),
  teacher: personSchema,
  student: personSchema.extend({ phone: z.string() }),
  location: z.object({ id: z.uuid(), name: z.string(), address: z.string() }),
  directionName: z.string().nullable(),
});

export type Lesson = z.infer<typeof lessonSchema>;

export const lessonListSchema = z.array(lessonSchema);

export const bookingRequestSchema = z.object({
  teacherId: z.uuid(),
  locationId: z.uuid(),
  pricePlanId: z.uuid(),
  /** The exact instant the slot endpoint offered - not a rounded local time. */
  startsAt: z.iso.datetime(),
  kind: z.enum(BOOKABLE_LESSON_KINDS),
});

export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export const cancelLessonSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type CancelLesson = z.infer<typeof cancelLessonSchema>;

/**
 * The plan is what fixes the duration, so a plan whose length is not one the
 * studio teaches is a data error rather than a request error - the check lives
 * here so both the API and the seed read the same rule.
 */
export function isSellableDuration(minutes: number): boolean {
  return (LESSON_DURATIONS as readonly number[]).includes(minutes);
}

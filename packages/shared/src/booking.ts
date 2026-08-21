import { z } from 'zod';
import { LESSON_DURATIONS, localDateSchema } from './availability';
import { sortOrderSchema } from './fields';
import { compareLocalDates, eachLocalDate, parseLocalDate } from './time';

export const LESSON_FORMATS = ['INDIVIDUAL', 'GROUP'] as const;

export type LessonFormat = (typeof LESSON_FORMATS)[number];

/**
 * A trial is free and one per student ever; a single lesson is paid outside
 * the system; a subscription lesson is drawn from a package the studio has
 * already issued.
 */
export const LESSON_KINDS = ['TRIAL', 'SINGLE', 'SUBSCRIPTION'] as const;

export type LessonKind = (typeof LESSON_KINDS)[number];

/**
 * Every kind a student can book themselves. Group lessons are not here: they
 * are generated from the group's timetable, not requested one at a time.
 */
export const BOOKABLE_LESSON_KINDS = ['TRIAL', 'SINGLE', 'SUBSCRIPTION'] as const;

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

/**
 * The row as the studio edits it. The direction's name is absent where the
 * public shape carries it: on the price screen the direction is a choice, not
 * a label, and the name is read from whichever one is chosen.
 */
export const adminPricePlanSchema = z.object({
  id: z.uuid(),
  directionId: z.uuid(),
  name: z.string(),
  lessonsCount: z.number().int(),
  durationMinutes: z.number().int(),
  format: z.enum(LESSON_FORMATS),
  priceUah: z.number().int(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});

export type AdminPricePlan = z.infer<typeof adminPricePlanSchema>;

export const adminPricePlanListSchema = z.array(adminPricePlanSchema);

/**
 * What the studio writes on the price screen. The direction's name is not
 * here: the plan names a direction and the name is read from it, so a renamed
 * subject cannot end up spelled two ways on the same page.
 */
const pricePlanFields = z.object({
  directionId: z.uuid(),
  name: z.string().trim().min(2).max(120),
  lessonsCount: z.coerce.number().int().min(1).max(100),
  /**
   * The bounds are the shortest lesson the studio sells and the longest thing
   * anyone would still call one lesson. Which durations can actually be booked
   * is a narrower question, decided by `LESSON_DURATIONS` and enforced when a
   * lesson is booked - the studio may price a 90-minute masterclass here and
   * arrange it by hand.
   */
  durationMinutes: z.coerce.number().int().min(15).max(240),
  format: z.enum(LESSON_FORMATS),
  priceUah: z.coerce.number().int().min(0).max(1_000_000),
  /**
   * Last season's price is deactivated rather than deleted: a subscription
   * already sold points at the plan it was sold against, and that has to keep
   * meaning what it meant.
   */
  isActive: z.boolean().default(true),
  sortOrder: sortOrderSchema.default(0),
});

export const pricePlanInputSchema = pricePlanFields;

export type PricePlanInput = z.infer<typeof pricePlanInputSchema>;

export const pricePlanPatchSchema = pricePlanFields.partial();

export type PricePlanPatch = z.infer<typeof pricePlanPatchSchema>;

const personSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
});

/**
 * A lesson as it is shown in a cabinet. The student's phone is included
 * because the teacher needs it and the endpoint only ever returns lessons the
 * caller is a party to - a student sees their own, a teacher sees theirs.
 *
 * Exactly one of `student` and `group` is set: an individual lesson belongs to
 * a person, a group lesson to a group, and the database enforces the choice.
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
  student: personSchema.extend({ phone: z.string() }).nullable(),
  group: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  location: z.object({ id: z.uuid(), name: z.string(), address: z.string() }),
  directionName: z.string().nullable(),
  /** Set when the lesson is drawn from a package, so the cabinet can say so. */
  subscriptionId: z.uuid().nullable(),
});

export type Lesson = z.infer<typeof lessonSchema>;

export const lessonListSchema = z.array(lessonSchema);

/**
 * What fixes the lesson's length differs by kind: a trial or a single lesson
 * names a price plan, a subscription lesson names the package it comes out of
 * and takes the length from the plan that package was sold against. Sending
 * both would let the two disagree, so the schema requires exactly the one that
 * applies.
 */
export const bookingRequestSchema = z
  .object({
    teacherId: z.uuid(),
    locationId: z.uuid(),
    /**
     * Who the lesson is for, when that is not the person asking.
     *
     * Only the studio may fill it in - a parent booking for another family's
     * child is not a thing that should be expressible - so the API ignores it
     * for anyone but an admin rather than refusing the request. Left out, the
     * lesson belongs to whoever sent it, which is every booking made from the
     * public site.
     */
    studentId: z.uuid().optional(),
    pricePlanId: z.uuid().optional(),
    subscriptionId: z.uuid().optional(),
    /** The exact instant the slot endpoint offered - not a rounded local time. */
    startsAt: z.iso.datetime(),
    kind: z.enum(BOOKABLE_LESSON_KINDS),
  })
  .superRefine((input, ctx) => {
    if (input.kind === 'SUBSCRIPTION') {
      if (!input.subscriptionId) {
        ctx.addIssue({
          code: 'custom',
          path: ['subscriptionId'],
          message: 'Оберіть абонемент',
        });
      }
      return;
    }

    if (!input.pricePlanId) {
      ctx.addIssue({ code: 'custom', path: ['pricePlanId'], message: 'Оберіть тариф' });
    }
  });

export type BookingRequest = z.infer<typeof bookingRequestSchema>;

/**
 * The studio's own view of its timetable: a stretch of days, optionally
 * narrowed to one teacher or one state.
 *
 * Bounded the same way the slot query is, and for the same reason - the range
 * decides how much work one request is - but wider, because a studio looking
 * at its term is a normal thing to do and a parent looking sixty days ahead
 * for a free hour is not.
 */
export const MAX_SCHEDULE_QUERY_DAYS = 120;

export const adminLessonQuerySchema = z
  .object({
    from: localDateSchema,
    to: localDateSchema,
    teacherId: z.uuid().optional(),
    status: z.enum(LESSON_STATUSES).optional(),
  })
  .superRefine((query, ctx) => {
    const from = parseLocalDate(query.from);
    const to = parseLocalDate(query.to);
    if (!from || !to) {
      return;
    }

    if (compareLocalDates(from, to) > 0) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'Кінець періоду раніше за початок' });
      return;
    }

    if (eachLocalDate(from, to).length > MAX_SCHEDULE_QUERY_DAYS) {
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: `Період не може перевищувати ${MAX_SCHEDULE_QUERY_DAYS} днів`,
      });
    }
  });

export type AdminLessonQuery = z.infer<typeof adminLessonQuerySchema>;

export const cancelLessonSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  /**
   * A late cancellation charges the lesson to the package by default. Only a
   * teacher or an admin ever reaches this endpoint late enough for it to
   * matter, and they are the ones who know whether the studio was at fault.
   */
  waiveCharge: z.boolean().optional(),
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

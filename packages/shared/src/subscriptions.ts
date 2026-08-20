import { z } from 'zod';
import { localDateSchema } from './availability';
import { compareLocalDates, parseLocalDate } from './time';

/**
 * Only the two states a person decides on. "Exhausted" and "expired" are not
 * stored: they follow from `lessonsUsed` against `lessonsTotal` and from
 * `validTo` against today, and a stored copy of a derived fact needs a job to
 * keep it true - the same reasoning that keeps the used-up trial out of a flag
 * on the student.
 */
export const SUBSCRIPTION_STATUSES = ['ACTIVE', 'CANCELLED'] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

const partySchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
});

/**
 * A package of lessons with one teacher.
 *
 * `lessonsReserved` is what separates a subscription from a counter: booking
 * does not draw a lesson (that happens when the lesson is marked completed),
 * so without counting the lessons already booked a student with eight paid
 * lessons could hold twenty places in the calendar.
 */
export const subscriptionSchema = z.object({
  id: z.uuid(),
  student: partySchema.extend({ phone: z.string() }),
  teacher: partySchema,
  directionName: z.string().nullable(),
  planName: z.string().nullable(),
  /** From the plan the package was sold against - what fixes a lesson's length. */
  durationMinutes: z.number().int().positive(),
  lessonsTotal: z.number().int().positive(),
  lessonsUsed: z.number().int().nonnegative(),
  lessonsReserved: z.number().int().nonnegative(),
  /** `lessonsTotal - lessonsUsed - lessonsReserved`: what can still be booked. */
  lessonsLeft: z.number().int(),
  priceUah: z.number().int().nonnegative(),
  validFrom: localDateSchema,
  validTo: localDateSchema,
  paidAt: z.iso.datetime().nullable(),
  status: z.enum(SUBSCRIPTION_STATUSES),
});

export type Subscription = z.infer<typeof subscriptionSchema>;

export const subscriptionListSchema = z.array(subscriptionSchema);

/**
 * The studio issues a subscription against a price plan, so the count and the
 * price are read from the plan rather than typed in twice - a plan of eight
 * lessons sold as six is a disagreement no screen would catch.
 */
export const subscriptionInputSchema = z
  .object({
    studentId: z.uuid(),
    teacherId: z.uuid(),
    pricePlanId: z.uuid(),
    validFrom: localDateSchema,
    validTo: localDateSchema,
    /** The studio marks payment separately, but cash at the desk is one step. */
    paid: z.boolean().optional(),
  })
  .superRefine((input, ctx) => {
    const from = parseLocalDate(input.validFrom);
    const to = parseLocalDate(input.validTo);

    if (from && to && compareLocalDates(to, from) < 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['validTo'],
        message: 'Кінець дії абонемента має бути не раніше за початок',
      });
    }
  });

export type SubscriptionInput = z.infer<typeof subscriptionInputSchema>;

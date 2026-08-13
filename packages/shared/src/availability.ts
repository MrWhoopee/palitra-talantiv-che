import { z } from 'zod';
import { compareLocalDates, parseLocalDate, parseTimeOfDay } from './time';

/** From the design doc: the duration comes from the price plan, not free input. */
export const LESSON_DURATIONS = [30, 45, 60] as const;

export type LessonDuration = (typeof LESSON_DURATIONS)[number];

export const AVAILABILITY_EXCEPTION_KINDS = ['VACATION', 'SICK', 'BLOCKED'] as const;

export type AvailabilityExceptionKind = (typeof AVAILABILITY_EXCEPTION_KINDS)[number];

/** 0 = Sunday, matching `Date.prototype.getUTCDay` and `weekdayOf`. */
export const weekdaySchema = z.number().int().min(0).max(6);

/**
 * A wall-clock date with no zone. The API speaks `YYYY-MM-DD` here rather than
 * a timestamp on purpose: "this rule applies from the first of September" is a
 * statement about the calendar, and turning it into an instant would make it
 * mean something slightly different in every zone that reads it.
 */
export const localDateSchema = z.string().refine((value) => parseLocalDate(value) !== null, {
  message: 'Очікується дата у форматі РРРР-ММ-ДД',
});

/** Local time of day, `HH:MM` in the studio's zone. */
export const timeOfDaySchema = z
  .string()
  .refine((value) => parseTimeOfDay(value) !== null, { message: 'Очікується час у форматі ГГ:ХВ' });

const ruleShape = {
  locationId: z.uuid(),
  weekday: weekdaySchema,
  startTime: timeOfDaySchema,
  endTime: timeOfDaySchema,
  validFrom: localDateSchema,
  validTo: localDateSchema.nullable().optional(),
};

function checkRuleBounds(
  rule: {
    startTime: string;
    endTime: string;
    validFrom: string;
    validTo?: string | null | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  const start = parseTimeOfDay(rule.startTime);
  const end = parseTimeOfDay(rule.endTime);

  if (start !== null && end !== null && end <= start) {
    ctx.addIssue({
      code: 'custom',
      path: ['endTime'],
      message: 'Кінець робочого вікна має бути пізніше за початок',
    });
  }

  const from = parseLocalDate(rule.validFrom);
  const to = rule.validTo ? parseLocalDate(rule.validTo) : null;

  if (from && to && compareLocalDates(to, from) < 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['validTo'],
      message: 'Кінець дії правила має бути не раніше за початок',
    });
  }
}

export const availabilityRuleInputSchema = z.object(ruleShape).superRefine(checkRuleBounds);

export type AvailabilityRuleInput = z.infer<typeof availabilityRuleInputSchema>;

export const availabilityRuleSchema = z.object({
  id: z.uuid(),
  teacherId: z.uuid(),
  ...ruleShape,
  validTo: localDateSchema.nullable(),
});

export type AvailabilityRule = z.infer<typeof availabilityRuleSchema>;

const exceptionShape = {
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  kind: z.enum(AVAILABILITY_EXCEPTION_KINDS),
  note: z.string().trim().max(500).nullable().optional(),
};

/**
 * Exceptions are instants rather than flags on a day: a holiday can start
 * halfway through an afternoon, and a day-shaped exception could not say so.
 */
export const availabilityExceptionInputSchema = z
  .object(exceptionShape)
  .refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
    path: ['endsAt'],
    message: 'Кінець має бути пізніше за початок',
  });

export type AvailabilityExceptionInput = z.infer<typeof availabilityExceptionInputSchema>;

export const availabilityExceptionSchema = z.object({
  id: z.uuid(),
  teacherId: z.uuid(),
  ...exceptionShape,
  note: z.string().nullable(),
});

export type AvailabilityException = z.infer<typeof availabilityExceptionSchema>;

export const slotSchema = z.object({
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  locationId: z.uuid(),
});

export type Slot = z.infer<typeof slotSchema>;

/** How far apart the query's two ends may be - a guard on the work per request. */
export const MAX_SLOT_QUERY_DAYS = 60;

export const slotQuerySchema = z
  .object({
    from: localDateSchema,
    to: localDateSchema,
    duration: z.coerce
      .number()
      .int()
      .refine(
        (value): value is LessonDuration => LESSON_DURATIONS.includes(value as LessonDuration),
        {
          message: 'Тривалість заняття може бути 30, 45 або 60 хвилин',
        },
      ),
  })
  .superRefine((query, ctx) => {
    const from = parseLocalDate(query.from);
    const to = parseLocalDate(query.to);
    if (!from || !to) {
      return;
    }

    if (compareLocalDates(to, from) < 0) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'Кінець періоду раніше за початок' });
      return;
    }

    const days = compareLocalDates(to, from) / (24 * 60 * 60 * 1000) + 1;
    if (days > MAX_SLOT_QUERY_DAYS) {
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: `Період не може перевищувати ${MAX_SLOT_QUERY_DAYS} днів`,
      });
    }
  });

export type SlotQuery = z.infer<typeof slotQuerySchema>;

export const slotsResponseSchema = z.object({
  teacherId: z.uuid(),
  durationMinutes: z.number().int().positive(),
  slots: z.array(slotSchema),
});

export type SlotsResponse = z.infer<typeof slotsResponseSchema>;

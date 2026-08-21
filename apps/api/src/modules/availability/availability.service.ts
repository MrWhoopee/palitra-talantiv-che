import {
  addLocalDays,
  formatLocalDate,
  formatTimeOfDay,
  fromZonedTime,
  parseTimeOfDay,
  toLocalDate,
  type AvailabilityException,
  type AvailabilityExceptionInput,
  type AvailabilityRule,
  type AvailabilityRuleInput,
  type SlotQuery,
  type SlotsResponse,
} from '@palitra/shared';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { DomainError } from '../../http/error-handler';
import { fromDbDate, requireLocalDate, toDbDate } from '../../lib/calendar-date';
import { SCHEDULING } from './availability.config';
import { computeFreeSlots, type TimeInterval } from './compute-free-slots';

const FOREIGN_KEY_VIOLATION = 'P2003';

export interface AvailabilityServiceDeps {
  prisma: PrismaClient;
  now?: () => Date;
  scheduling?: typeof SCHEDULING;
}

export interface AvailabilityService {
  listRules(teacherId: string): Promise<AvailabilityRule[]>;
  createRule(teacherId: string, input: AvailabilityRuleInput): Promise<AvailabilityRule>;
  updateRule(
    teacherId: string,
    ruleId: string,
    input: AvailabilityRuleInput,
  ): Promise<AvailabilityRule>;
  deleteRule(teacherId: string, ruleId: string): Promise<void>;
  listExceptions(teacherId: string): Promise<AvailabilityException[]>;
  createException(
    teacherId: string,
    input: AvailabilityExceptionInput,
  ): Promise<AvailabilityException>;
  deleteException(teacherId: string, exceptionId: string): Promise<void>;
  getSlots(teacherId: string, query: SlotQuery): Promise<SlotsResponse>;
}

export function createAvailabilityService({
  prisma,
  now = () => new Date(),
  scheduling = SCHEDULING,
}: AvailabilityServiceDeps): AvailabilityService {
  async function requireTeacher(teacherId: string): Promise<boolean> {
    const profile = await prisma.teacherProfile.findUnique({
      where: { userId: teacherId },
      select: { isActive: true },
    });
    if (!profile) {
      throw new DomainError('NOT_FOUND', 'Викладача не знайдено');
    }
    return profile.isActive;
  }

  /**
   * Only PENDING and CONFIRMED lessons hold the teacher's time. A cancelled
   * one gives the hour back, and a completed one is in the past - the same set
   * the `lesson_no_overlap` constraint is defined over, deliberately, so what
   * the calendar offers and what the database accepts cannot disagree.
   */
  async function loadBusyLessons(teacherId: string, range: TimeInterval): Promise<TimeInterval[]> {
    return prisma.lesson.findMany({
      where: {
        teacherId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startsAt: { lt: range.endsAt },
        endsAt: { gt: range.startsAt },
      },
      select: { startsAt: true, endsAt: true },
    });
  }

  function ruleData(input: AvailabilityRuleInput) {
    return {
      locationId: input.locationId,
      weekday: input.weekday,
      startMinute: parseTimeOfDay(input.startTime) ?? 0,
      endMinute: parseTimeOfDay(input.endTime) ?? 0,
      validFrom: toDbDate(requireLocalDate(input.validFrom)),
      validTo: input.validTo ? toDbDate(requireLocalDate(input.validTo)) : null,
    };
  }

  return {
    async listRules(teacherId: string): Promise<AvailabilityRule[]> {
      await requireTeacher(teacherId);

      const rules = await prisma.availabilityRule.findMany({
        where: { teacherId },
        orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
      });

      return rules.map(toRule);
    },

    async createRule(teacherId: string, input: AvailabilityRuleInput): Promise<AvailabilityRule> {
      await requireTeacher(teacherId);

      try {
        const rule = await prisma.availabilityRule.create({
          data: { teacherId, ...ruleData(input) },
        });
        return toRule(rule);
      } catch (error) {
        throw asMissingReference(error);
      }
    },

    /**
     * Ownership is part of the `where` clause rather than a check before it:
     * a teacher who guesses a colleague's rule id updates nothing and is told
     * the rule does not exist, and there is no ordering of statements in which
     * the check can be skipped.
     */
    async updateRule(
      teacherId: string,
      ruleId: string,
      input: AvailabilityRuleInput,
    ): Promise<AvailabilityRule> {
      let updated;
      try {
        updated = await prisma.availabilityRule.updateMany({
          where: { id: ruleId, teacherId },
          data: ruleData(input),
        });
      } catch (error) {
        throw asMissingReference(error);
      }

      if (updated.count === 0) {
        throw new DomainError('NOT_FOUND', 'Правило не знайдено');
      }

      const rule = await prisma.availabilityRule.findUniqueOrThrow({ where: { id: ruleId } });
      return toRule(rule);
    },

    async deleteRule(teacherId: string, ruleId: string): Promise<void> {
      const deleted = await prisma.availabilityRule.deleteMany({
        where: { id: ruleId, teacherId },
      });

      if (deleted.count === 0) {
        throw new DomainError('NOT_FOUND', 'Правило не знайдено');
      }
    },

    async listExceptions(teacherId: string): Promise<AvailabilityException[]> {
      await requireTeacher(teacherId);

      const exceptions = await prisma.availabilityException.findMany({
        where: { teacherId },
        orderBy: { startsAt: 'asc' },
      });

      return exceptions.map(toException);
    },

    async createException(
      teacherId: string,
      input: AvailabilityExceptionInput,
    ): Promise<AvailabilityException> {
      await requireTeacher(teacherId);

      const exception = await prisma.availabilityException.create({
        data: {
          teacherId,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          kind: input.kind,
          note: input.note ?? null,
        },
      });

      return toException(exception);
    },

    async deleteException(teacherId: string, exceptionId: string): Promise<void> {
      const deleted = await prisma.availabilityException.deleteMany({
        where: { id: exceptionId, teacherId },
      });

      if (deleted.count === 0) {
        throw new DomainError('NOT_FOUND', 'Виняток не знайдено');
      }
    },

    async getSlots(teacherId: string, query: SlotQuery): Promise<SlotsResponse> {
      const isActive = await requireTeacher(teacherId);

      // A teacher who has left keeps their rules and their history - both are
      // still true of the past - but has no free time to offer. Empty rather
      // than 404: their profile page and their finished lessons still exist,
      // there is simply nothing left to book. Booking asks this same question
      // through `assertSlotIsOffered`, so the refusal reaches that path too.
      if (!isActive) {
        return { teacherId, durationMinutes: query.duration, slots: [] };
      }

      const moment = now();
      const requestedFrom = fromZonedTime(requireLocalDate(query.from), 0);
      // `to` names a day the caller wants included, so the range runs to the
      // start of the day after it.
      const requestedTo = fromZonedTime(addLocalDays(requireLocalDate(query.to), 1), 0);

      // A slot in the past cannot be booked, and neither can one past the
      // horizon - offering either would be a promise the booking endpoint
      // then refuses.
      const horizonEnd = new Date(
        moment.getTime() + scheduling.bookingHorizonDays * 24 * 60 * 60 * 1000,
      );
      const startsAt = requestedFrom > moment ? requestedFrom : moment;
      const endsAt = requestedTo < horizonEnd ? requestedTo : horizonEnd;

      if (endsAt <= startsAt) {
        return { teacherId, durationMinutes: query.duration, slots: [] };
      }

      const [rules, exceptions] = await Promise.all([
        prisma.availabilityRule.findMany({
          where: {
            teacherId,
            validFrom: { lte: toDbDate(toLocalDate(endsAt)) },
            OR: [{ validTo: null }, { validTo: { gte: toDbDate(toLocalDate(startsAt)) } }],
          },
        }),
        prisma.availabilityException.findMany({
          where: { teacherId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
        }),
      ]);

      const busyLessons = await loadBusyLessons(teacherId, { startsAt, endsAt });

      const slots = computeFreeSlots({
        rules: rules.map((rule) => ({
          locationId: rule.locationId,
          weekday: rule.weekday,
          startMinute: rule.startMinute,
          endMinute: rule.endMinute,
          validFrom: fromDbDate(rule.validFrom),
          validTo: rule.validTo ? fromDbDate(rule.validTo) : null,
        })),
        exceptions,
        busyLessons,
        range: { startsAt, endsAt },
        durationMinutes: query.duration,
        stepMinutes: scheduling.slotStepMinutes,
      });

      return {
        teacherId,
        durationMinutes: query.duration,
        slots: slots.map((slot) => ({
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
          locationId: slot.locationId,
        })),
      };
    },
  };
}

interface RuleRow {
  id: string;
  teacherId: string;
  locationId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  validFrom: Date;
  validTo: Date | null;
}

function toRule(rule: RuleRow): AvailabilityRule {
  return {
    id: rule.id,
    teacherId: rule.teacherId,
    locationId: rule.locationId,
    weekday: rule.weekday,
    startTime: formatTimeOfDay(rule.startMinute),
    endTime: formatTimeOfDay(rule.endMinute),
    validFrom: formatLocalDate(fromDbDate(rule.validFrom)),
    validTo: rule.validTo ? formatLocalDate(fromDbDate(rule.validTo)) : null,
  };
}

interface ExceptionRow {
  id: string;
  teacherId: string;
  startsAt: Date;
  endsAt: Date;
  kind: 'VACATION' | 'SICK' | 'BLOCKED';
  note: string | null;
}

function toException(exception: ExceptionRow): AvailabilityException {
  return {
    id: exception.id,
    teacherId: exception.teacherId,
    startsAt: exception.startsAt.toISOString(),
    endsAt: exception.endsAt.toISOString(),
    kind: exception.kind,
    note: exception.note,
  };
}

/**
 * A location id that no row matches is not a server fault - it is a request
 * naming something that does not exist.
 */
function asMissingReference(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === FOREIGN_KEY_VIOLATION
  ) {
    return new DomainError('NOT_FOUND', 'Локацію не знайдено');
  }
  return error;
}

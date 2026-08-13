import { parseLocalDate, type LocalDate } from '@palitra/shared';
import { DomainError } from '../http/error-handler';

/**
 * Postgres `date` columns come back through Prisma as a `Date` at midnight UTC.
 * That is a representation, not a moment: reading it with `getFullYear` on a
 * machine west of Greenwich would shift "1 September" to 31 August. These two
 * functions are the only places allowed to cross that boundary.
 */
export function fromDbDate(value: Date): LocalDate {
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

export function toDbDate(date: LocalDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

/** For values that a zod schema has already accepted as `YYYY-MM-DD`. */
export function requireLocalDate(value: string): LocalDate {
  const parsed = parseLocalDate(value);
  if (!parsed) {
    throw new DomainError('VALIDATION_FAILED', 'Некоректна дата');
  }
  return parsed;
}

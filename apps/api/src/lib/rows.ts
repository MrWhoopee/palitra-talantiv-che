import type { DomainErrorCode } from '@palitra/shared';
import { Prisma } from '../generated/prisma/client.js';
import { DomainError } from '../http/error-handler';

/**
 * The handful of things every editing service does with a single row.
 *
 * Prisma reports these as codes on an error class, and a service that reads
 * them inline ends up with the same `instanceof` and the same string constant
 * in a dozen places. Here they are named once, and what each one means to the
 * person on the other end of the request is decided by the caller, which is
 * the only place that knows whether `P2025` was a missing event or a missing
 * teacher.
 */

const UNIQUE_VIOLATION = 'P2002';
const RECORD_NOT_FOUND = 'P2025';
const FOREIGN_KEY_VIOLATION = 'P2003';

export function isPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/**
 * A write whose uniqueness the database decides.
 *
 * Checking first and inserting after would let two rows created in the same
 * second both pass the check - the index is the only thing that can answer
 * this without a race.
 */
export async function withUnique<T>(
  write: () => Promise<T>,
  code: DomainErrorCode,
  message: string,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isPrismaCode(error, UNIQUE_VIOLATION)) {
      throw new DomainError(code, message);
    }
    throw error;
  }
}

export async function updateRow<T>(write: () => Promise<T>, message: string): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isPrismaCode(error, RECORD_NOT_FOUND)) {
      throw new DomainError('NOT_FOUND', message);
    }
    throw error;
  }
}

export async function deleteRow(write: () => Promise<unknown>, message: string): Promise<void> {
  await updateRow(write, message);
}

/** A write that names a row in another table which has to exist. */
export function withReferences<T>(write: () => Promise<T>, message: string): Promise<T> {
  return onForeignKey(write, 'VALIDATION_FAILED', message);
}

/**
 * A delete the rest of the system may be standing on. The database is what
 * decides: counting the dependants first would be a different question asked
 * of a different moment, and the constraint is the one that actually holds.
 */
export function withDependents<T>(write: () => Promise<T>, message: string): Promise<T> {
  return onForeignKey(write, 'IN_USE', message);
}

async function onForeignKey<T>(
  write: () => Promise<T>,
  code: DomainErrorCode,
  message: string,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isPrismaCode(error, FOREIGN_KEY_VIOLATION)) {
      throw new DomainError(code, message);
    }
    throw error;
  }
}

/**
 * A patch without the keys that were never sent.
 *
 * `{ title: undefined }` and "no title in the body" mean the same thing here -
 * leave it alone - but they are not the same value to Prisma, which reads an
 * explicit `undefined` as a field it must not have been given at all. Dropping
 * the keys says it once, instead of at every call site.
 */
export function defined<T extends object>(patch: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as never;
}

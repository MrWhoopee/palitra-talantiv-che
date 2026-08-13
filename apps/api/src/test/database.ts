import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * The test database name is derived from `DATABASE_URL` rather than configured
 * separately: one variable to set in CI, and `resetDatabase` can never be
 * pointed at the development database by a stale `.env` entry.
 */
export function testDatabaseUrl(source: NodeJS.ProcessEnv = process.env): URL {
  const raw = source['DATABASE_URL'];
  if (!raw) {
    throw new Error('DATABASE_URL must be set to run the integration tests');
  }

  const url = new URL(raw);
  const database = url.pathname.replace(/^\//, '');
  if (!database) {
    throw new Error(`DATABASE_URL has no database name: ${raw}`);
  }
  if (database.endsWith('_test')) {
    return url;
  }

  url.pathname = `/${database}_test`;
  return url;
}

export function adminDatabaseUrl(source: NodeJS.ProcessEnv = process.env): URL {
  const url = testDatabaseUrl(source);
  // `CREATE DATABASE` has to be issued from a connection to some *other*
  // database; `postgres` always exists in the official image.
  url.pathname = '/postgres';
  return url;
}

export function createTestPrisma(url: URL = testDatabaseUrl()): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
}

/**
 * Truncating beats re-running migrations between tests: it is a single
 * statement, and `CASCADE` reaches everything downstream through the foreign
 * keys. Only the roots are listed - a table is added here when nothing points
 * at it from above (tokens, profiles, rules and lessons all hang off `User`;
 * price plans hang off `Direction`).
 */
const ROOT_TABLES = ['"User"', '"Location"', '"Direction"'].join(', ');

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${ROOT_TABLES} RESTART IDENTITY CASCADE`);
}

import 'dotenv/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { adminDatabaseUrl, testDatabaseUrl } from './database';

const run = promisify(execFile);

const DUPLICATE_DATABASE = '42P04';

/**
 * Creates the test database next to the development one and brings it up to
 * date before any test file runs. Integration tests talk to a real Postgres
 * on purpose: half of the rules that matter here (unique email, cascading
 * token deletes, and from stage 3 the overlap exclusion constraint) live in
 * the database, and a mocked client would assert nothing about them.
 */
export default async function setup(): Promise<void> {
  const testUrl = testDatabaseUrl();
  const databaseName = testUrl.pathname.replace(/^\//, '');

  const admin = new PrismaClient({
    adapter: new PrismaPg({ connectionString: adminDatabaseUrl().toString() }),
  });

  try {
    // Not parameterisable: `CREATE DATABASE` takes an identifier, not a value.
    // The name comes from our own DATABASE_URL, never from user input.
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  } catch (error) {
    if (!isDuplicateDatabase(error)) {
      throw error;
    }
  } finally {
    await admin.$disconnect();
  }

  await run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    shell: process.platform === 'win32',
  });
}

function isDuplicateDatabase(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  const message = error instanceof Error ? error.message : '';
  return code === DUPLICATE_DATABASE || message.includes('already exists');
}

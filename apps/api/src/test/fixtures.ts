import { parseLocalDate, parseTimeOfDay, weekdayOf } from '@palitra/shared';
import type { PrismaClient } from '../generated/prisma/client.js';
import { toDbDate } from '../lib/calendar-date';

/**
 * Row builders for the integration tests. They write through Prisma rather
 * than through the API because the state they set up - a published teacher, a
 * location, a working rule - is what the endpoint under test reads, and going
 * through HTTP would make every test depend on the endpoints of two modules.
 */

let sequence = 0;

function unique(prefix: string): string {
  sequence += 1;
  return `${prefix}${sequence}`;
}

export interface UserOptions {
  email?: string;
  role?: 'ADMIN' | 'TEACHER' | 'STUDENT';
  firstName?: string;
  lastName?: string;
  phone?: string;
  emailVerified?: boolean;
}

export async function createUser(prisma: PrismaClient, options: UserOptions = {}) {
  return prisma.user.create({
    data: {
      email: options.email ?? `${unique('person')}@example.com`,
      // Never used for signing in: these tests reach past the password check.
      passwordHash: 'not-a-real-hash',
      role: options.role ?? 'STUDENT',
      firstName: options.firstName ?? 'Олена',
      lastName: options.lastName ?? 'Коваль',
      phone: options.phone ?? '+380671234567',
      emailVerifiedAt: options.emailVerified === false ? null : new Date('2026-01-01T00:00:00Z'),
    },
  });
}

export interface TeacherOptions extends UserOptions {
  isPublished?: boolean;
  bio?: string;
  experienceYears?: number;
  locationIds?: string[];
  directionIds?: string[];
}

export async function createTeacher(prisma: PrismaClient, options: TeacherOptions = {}) {
  const user = await createUser(prisma, { ...options, role: 'TEACHER' });

  await prisma.teacherProfile.create({
    data: {
      userId: user.id,
      isPublished: options.isPublished ?? true,
      bio: options.bio ?? null,
      experienceYears: options.experienceYears ?? null,
      locations: {
        create: (options.locationIds ?? []).map((locationId) => ({ locationId })),
      },
      directions: {
        create: (options.directionIds ?? []).map((directionId) => ({ directionId })),
      },
    },
  });

  return user;
}

export async function createLocation(
  prisma: PrismaClient,
  options: { name?: string; address?: string } = {},
) {
  return prisma.location.create({
    data: {
      name: options.name ?? unique('Локація '),
      address: options.address ?? 'вул. Благовісна, 170',
    },
  });
}

export async function createDirection(
  prisma: PrismaClient,
  options: { slug?: string; name?: string } = {},
) {
  return prisma.direction.create({
    data: {
      slug: options.slug ?? unique('direction-'),
      name: options.name ?? 'Вокал',
    },
  });
}

/** `createRule(prisma, { ... on: '2026-09-01', from: '10:00', to: '18:00' })`. */
export async function createRule(
  prisma: PrismaClient,
  options: {
    teacherId: string;
    locationId: string;
    /** Any date falling on the weekday the rule repeats on. */
    on: string;
    from: string;
    to: string;
    validFrom?: string;
    validTo?: string;
  },
) {
  const sample = parseLocalDate(options.on);
  const validFrom = parseLocalDate(options.validFrom ?? '2020-01-01');
  const validTo = options.validTo ? parseLocalDate(options.validTo) : null;

  if (!sample || !validFrom) {
    throw new Error('Fixture needs valid dates');
  }

  return prisma.availabilityRule.create({
    data: {
      teacherId: options.teacherId,
      locationId: options.locationId,
      weekday: weekdayOf(sample),
      startMinute: parseTimeOfDay(options.from) ?? 0,
      endMinute: parseTimeOfDay(options.to) ?? 0,
      validFrom: toDbDate(validFrom),
      validTo: validTo ? toDbDate(validTo) : null,
    },
  });
}

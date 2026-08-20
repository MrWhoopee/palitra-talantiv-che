import 'dotenv/config';
import {
  addLocalDays,
  formatLocalDate,
  parseLocalDate,
  parseTimeOfDay,
  toLocalDate,
  weekdayOf,
} from '@palitra/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { Actor } from '../src/http/actor';
import { toDbDate } from '../src/lib/calendar-date';
import { hashPassword } from '../src/lib/password';
import { createGroupsService } from '../src/modules/groups/groups.service';
import { createSubscriptionService } from '../src/modules/subscriptions/subscriptions.service';

/**
 * Realistic development data: without it neither the interface nor a bug
 * report can be reproduced, because every screen in the system is a view of a
 * timetable that has to exist first.
 *
 * Written to be re-runnable: every row is upserted on a natural key, so
 * running the seed twice leaves the same database rather than a doubled one.
 * It refuses to run against a production database.
 */

const PASSWORD = 'palitra-demo-2026';

const LOCATIONS = [
  { slug: 'blahovisna', name: 'Благовісна', address: 'вул. Благовісна, 170, Черкаси' },
  { slug: 'shevchenka', name: 'Шевченка', address: 'бул. Шевченка, 276, Черкаси' },
];

/**
 * Every plan the studio sells. `lessonsCount: 1` is a single lesson, a larger
 * one is what a subscription is sold against, and a `GROUP` plan prices a
 * course rather than an hour. The duration lives here rather than on the
 * booking form because it is the tariff that fixes it.
 */
const PRICE_PLANS = [
  {
    direction: 'vocal',
    name: 'Разове заняття',
    lessonsCount: 1,
    durationMinutes: 45,
    priceUah: 400,
  },
  {
    direction: 'vocal',
    name: 'Абонемент 8 занять',
    lessonsCount: 8,
    durationMinutes: 45,
    priceUah: 2800,
  },
  {
    direction: 'piano',
    name: 'Разове заняття',
    lessonsCount: 1,
    durationMinutes: 45,
    priceUah: 400,
  },
  {
    direction: 'piano',
    name: 'Абонемент 8 занять',
    lessonsCount: 8,
    durationMinutes: 60,
    priceUah: 3600,
  },
  {
    direction: 'guitar',
    name: 'Разове заняття',
    lessonsCount: 1,
    durationMinutes: 60,
    priceUah: 450,
  },
  {
    direction: 'ukulele',
    name: 'Разове заняття',
    lessonsCount: 1,
    durationMinutes: 30,
    priceUah: 300,
  },
  {
    direction: 'vocal',
    name: 'Ансамбль, місяць',
    lessonsCount: 4,
    durationMinutes: 60,
    priceUah: 1400,
    format: 'GROUP' as const,
  },
  {
    direction: 'guitar',
    name: 'Ансамбль, місяць',
    lessonsCount: 4,
    durationMinutes: 60,
    priceUah: 1400,
    format: 'GROUP' as const,
  },
];

const DIRECTIONS = [
  { slug: 'vocal', name: 'Вокал', description: 'Естрадний і академічний вокал, постановка голосу' },
  { slug: 'piano', name: 'Фортепіано', description: 'Класика та сучасний репертуар' },
  { slug: 'guitar', name: 'Гітара', description: 'Акустична та електрогітара' },
  { slug: 'ukulele', name: 'Укулеле', description: 'Найшвидший шлях до перших пісень' },
];

interface TeacherSeed {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  experienceYears: number;
  bio: string;
  directions: string[];
  locations: string[];
  /** Weekday sample date plus the working window, in local time. */
  schedule: { on: string; from: string; to: string; location: string }[];
}

/** A Monday, so the sample dates below read as a week. */
const WEEK = {
  monday: '2026-01-05',
  tuesday: '2026-01-06',
  wednesday: '2026-01-07',
  thursday: '2026-01-08',
  friday: '2026-01-09',
  saturday: '2026-01-10',
};

const TEACHERS: TeacherSeed[] = [
  {
    email: 'iryna@palitra-talantiv.local',
    firstName: 'Ірина',
    lastName: 'Мельник',
    phone: '+380671110001',
    experienceYears: 14,
    bio: 'Засновниця студії. Естрадний вокал, підготовка до конкурсів.',
    directions: ['vocal'],
    locations: ['blahovisna'],
    schedule: [
      { on: WEEK.monday, from: '10:00', to: '18:00', location: 'blahovisna' },
      { on: WEEK.wednesday, from: '10:00', to: '18:00', location: 'blahovisna' },
      { on: WEEK.friday, from: '12:00', to: '19:00', location: 'blahovisna' },
    ],
  },
  {
    email: 'oleh@palitra-talantiv.local',
    firstName: 'Олег',
    lastName: 'Гриценко',
    phone: '+380671110002',
    experienceYears: 9,
    bio: 'Фортепіано для дітей і дорослих, імпровізація.',
    directions: ['piano'],
    locations: ['blahovisna', 'shevchenka'],
    schedule: [
      { on: WEEK.tuesday, from: '09:00', to: '15:00', location: 'blahovisna' },
      { on: WEEK.thursday, from: '14:00', to: '20:00', location: 'shevchenka' },
    ],
  },
  {
    email: 'maryna@palitra-talantiv.local',
    firstName: 'Марина',
    lastName: 'Шевчук',
    phone: '+380671110003',
    experienceYears: 7,
    bio: 'Академічний вокал, робота з диханням.',
    directions: ['vocal', 'piano'],
    locations: ['shevchenka'],
    schedule: [
      { on: WEEK.monday, from: '14:00', to: '20:00', location: 'shevchenka' },
      { on: WEEK.thursday, from: '14:00', to: '20:00', location: 'shevchenka' },
    ],
  },
  {
    email: 'andrii@palitra-talantiv.local',
    firstName: 'Андрій',
    lastName: 'Ковтун',
    phone: '+380671110004',
    experienceYears: 11,
    bio: 'Гітара: від перших акордів до сольної гри.',
    directions: ['guitar', 'ukulele'],
    locations: ['blahovisna'],
    schedule: [
      { on: WEEK.tuesday, from: '15:00', to: '21:00', location: 'blahovisna' },
      { on: WEEK.saturday, from: '10:00', to: '16:00', location: 'blahovisna' },
    ],
  },
  {
    email: 'sofiia@palitra-talantiv.local',
    firstName: 'Софія',
    lastName: 'Романюк',
    phone: '+380671110005',
    experienceYears: 5,
    bio: 'Укулеле та вокал для наймолодших.',
    directions: ['ukulele', 'vocal'],
    locations: ['shevchenka'],
    schedule: [
      { on: WEEK.wednesday, from: '11:00', to: '17:00', location: 'shevchenka' },
      { on: WEEK.saturday, from: '10:00', to: '14:00', location: 'shevchenka' },
    ],
  },
  {
    email: 'dmytro@palitra-talantiv.local',
    firstName: 'Дмитро',
    lastName: 'Литвин',
    phone: '+380671110006',
    experienceYears: 8,
    bio: 'Гітара, ансамблева гра, підготовка до концертів.',
    directions: ['guitar'],
    locations: ['blahovisna', 'shevchenka'],
    schedule: [
      { on: WEEK.monday, from: '16:00', to: '21:00', location: 'blahovisna' },
      { on: WEEK.friday, from: '15:00', to: '20:00', location: 'shevchenka' },
    ],
  },
  {
    email: 'kateryna@palitra-talantiv.local',
    firstName: 'Катерина',
    lastName: 'Бондар',
    phone: '+380671110007',
    experienceYears: 6,
    bio: 'Фортепіано, сольфеджіо, музична грамота.',
    directions: ['piano'],
    locations: ['blahovisna'],
    schedule: [
      { on: WEEK.wednesday, from: '09:00', to: '14:00', location: 'blahovisna' },
      { on: WEEK.friday, from: '09:00', to: '14:00', location: 'blahovisna' },
    ],
  },
  {
    email: 'yurii@palitra-talantiv.local',
    firstName: 'Юрій',
    lastName: 'Панченко',
    phone: '+380671110008',
    experienceYears: 12,
    bio: 'Вокал для дорослих, робота з мікрофоном.',
    directions: ['vocal'],
    locations: ['shevchenka'],
    schedule: [{ on: WEEK.tuesday, from: '17:00', to: '21:00', location: 'shevchenka' }],
  },
];

const STUDENTS = [
  {
    email: 'student@palitra-talantiv.local',
    firstName: 'Олена',
    lastName: 'Коваль',
    phone: '+380672220001',
  },
  {
    email: 'taras@palitra-talantiv.local',
    firstName: 'Тарас',
    lastName: 'Ткаченко',
    phone: '+380672220002',
  },
  {
    email: 'nadiia@palitra-talantiv.local',
    firstName: 'Надія',
    lastName: 'Гриб',
    phone: '+380672220003',
  },
];

/**
 * Two standing courses, one per address the studio uses most. Their meetings
 * are generated through the same service the interface calls, so the demo data
 * cannot drift from what a teacher would get by filling in the form.
 */
const GROUPS = [
  {
    name: 'Вокальний ансамбль',
    teacher: 'iryna@palitra-talantiv.local',
    direction: 'vocal',
    location: 'blahovisna',
    capacity: 8,
    durationMinutes: 60,
    /** Wednesdays at five, inside Iryna's working window. */
    schedule: [{ on: WEEK.wednesday, at: '17:00' }],
    /** Two active members and nobody waiting. */
    members: ['student@palitra-talantiv.local', 'taras@palitra-talantiv.local'],
    applicants: [] as string[],
  },
  {
    name: 'Гітарний ансамбль',
    teacher: 'andrii@palitra-talantiv.local',
    direction: 'guitar',
    location: 'blahovisna',
    capacity: 6,
    durationMinutes: 60,
    /** Saturdays at noon, inside Andrii's window. */
    schedule: [{ on: WEEK.saturday, at: '12:00' }],
    members: ['nadiia@palitra-talantiv.local'],
    /** One application waiting, so the teacher's cabinet has something to do. */
    applicants: ['taras@palitra-talantiv.local'],
  },
];

/** One package in flight, so the cabinet shows a counter that moves. */
const SUBSCRIPTIONS = [
  {
    student: 'student@palitra-talantiv.local',
    teacher: 'iryna@palitra-talantiv.local',
    direction: 'vocal',
    planName: 'Абонемент 8 занять',
    paid: true,
  },
];

const ADMIN = {
  email: 'admin@palitra-talantiv.local',
  firstName: 'Адміністратор',
  lastName: 'Студії',
  phone: '+380670000000',
};

async function main(): Promise<void> {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL must be set');
  }
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('The seed writes demo accounts with a known password - not for production');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  // One hash for every demo account: the cost is the point in production and
  // pure waiting here, where the password is printed at the end anyway.
  const passwordHash = await hashPassword(PASSWORD, 10);

  try {
    const locations = new Map<string, string>();
    for (const [index, location] of LOCATIONS.entries()) {
      const row = await prisma.location.upsert({
        where: { id: await idOfLocation(prisma, location.name) },
        update: { address: location.address, sortOrder: index },
        create: { name: location.name, address: location.address, sortOrder: index },
      });
      locations.set(location.slug, row.id);
    }

    const directions = new Map<string, string>();
    for (const [index, direction] of DIRECTIONS.entries()) {
      const row = await prisma.direction.upsert({
        where: { slug: direction.slug },
        update: { name: direction.name, description: direction.description, sortOrder: index },
        create: { ...direction, sortOrder: index },
      });
      directions.set(direction.slug, row.id);
    }

    for (const [index, plan] of PRICE_PLANS.entries()) {
      const directionId = required(directions, plan.direction);
      const existing = await prisma.pricePlan.findFirst({
        where: { directionId, name: plan.name, durationMinutes: plan.durationMinutes },
        select: { id: true },
      });

      const data = {
        directionId,
        name: plan.name,
        lessonsCount: plan.lessonsCount,
        durationMinutes: plan.durationMinutes,
        priceUah: plan.priceUah,
        format: plan.format ?? ('INDIVIDUAL' as const),
        isActive: true,
        sortOrder: index,
      };

      if (existing) {
        await prisma.pricePlan.update({ where: { id: existing.id }, data });
      } else {
        await prisma.pricePlan.create({ data });
      }
    }

    await prisma.user.upsert({
      where: { email: ADMIN.email },
      update: { role: 'ADMIN' },
      create: { ...ADMIN, passwordHash, role: 'ADMIN', emailVerifiedAt: new Date() },
    });

    for (const [index, teacher] of TEACHERS.entries()) {
      const user = await prisma.user.upsert({
        where: { email: teacher.email },
        update: { role: 'TEACHER' },
        create: {
          email: teacher.email,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          phone: teacher.phone,
          passwordHash,
          role: 'TEACHER',
          emailVerifiedAt: new Date(),
        },
      });

      await prisma.teacherProfile.upsert({
        where: { userId: user.id },
        update: {
          bio: teacher.bio,
          experienceYears: teacher.experienceYears,
          isPublished: true,
          sortOrder: index,
        },
        create: {
          userId: user.id,
          bio: teacher.bio,
          experienceYears: teacher.experienceYears,
          isPublished: true,
          sortOrder: index,
        },
      });

      // Links and rules are rebuilt rather than merged: the seed file is the
      // source of truth for demo data, and a half-updated timetable is harder
      // to reason about than one that is simply rewritten.
      await prisma.teacherLocation.deleteMany({ where: { teacherId: user.id } });
      await prisma.teacherDirection.deleteMany({ where: { teacherId: user.id } });
      await prisma.availabilityRule.deleteMany({ where: { teacherId: user.id } });

      await prisma.teacherLocation.createMany({
        data: teacher.locations.map((slug) => ({
          teacherId: user.id,
          locationId: required(locations, slug),
        })),
      });

      await prisma.teacherDirection.createMany({
        data: teacher.directions.map((slug) => ({
          teacherId: user.id,
          directionId: required(directions, slug),
        })),
      });

      await prisma.availabilityRule.createMany({
        data: teacher.schedule.map((window) => ({
          teacherId: user.id,
          locationId: required(locations, window.location),
          weekday: weekdayOf(requireDate(window.on)),
          startMinute: requireTime(window.from),
          endMinute: requireTime(window.to),
          validFrom: toDbDate(requireDate('2026-01-01')),
        })),
      });
    }

    for (const student of STUDENTS) {
      await prisma.user.upsert({
        where: { email: student.email },
        update: {},
        create: { ...student, passwordHash, role: 'STUDENT', emailVerifiedAt: new Date() },
      });
    }

    const today = toLocalDate(new Date());
    const groupsService = createGroupsService({ prisma });
    const subscriptionsService = createSubscriptionService({ prisma });

    for (const group of GROUPS) {
      const teacherId = await userIdByEmail(prisma, group.teacher);
      const actor: Actor = { userId: teacherId, role: 'TEACHER' };

      const input = {
        name: group.name,
        directionId: required(directions, group.direction),
        locationId: required(locations, group.location),
        capacity: group.capacity,
        durationMinutes: group.durationMinutes,
        isOpenForEnrollment: true,
        // Starting today keeps the demo calendar full however long after the
        // seed was written the database is created.
        startsOn: formatLocalDate(today),
        endsOn: null,
        schedule: group.schedule.map((meeting) => ({
          weekday: weekdayOf(requireDate(meeting.on)),
          startTime: meeting.at,
        })),
      };

      const existing = await prisma.group.findFirst({
        where: { teacherId, name: group.name },
        select: { id: true },
      });

      const saved = existing
        ? await groupsService.update(actor, existing.id, input)
        : await groupsService.create(actor, input);

      for (const [email, approve] of [
        ...group.members.map((email) => [email, true] as const),
        ...group.applicants.map((email) => [email, false] as const),
      ]) {
        const studentId = await userIdByEmail(prisma, email);
        const enrollment = await groupsService
          .apply({ userId: studentId, role: 'STUDENT' }, saved.group.id)
          // Running the seed twice finds the person already in the group,
          // which is the state it wanted in the first place.
          .catch(() => null);

        if (enrollment && approve) {
          await groupsService.approve(actor, enrollment.id);
        }
      }
    }

    for (const subscription of SUBSCRIPTIONS) {
      const studentId = await userIdByEmail(prisma, subscription.student);
      const teacherId = await userIdByEmail(prisma, subscription.teacher);
      const plan = await prisma.pricePlan.findFirst({
        where: {
          directionId: required(directions, subscription.direction),
          name: subscription.planName,
        },
        select: { id: true },
      });

      if (!plan) {
        throw new Error(`Seed refers to an unknown price plan: ${subscription.planName}`);
      }

      const already = await prisma.subscription.findFirst({
        where: { studentId, teacherId, pricePlanId: plan.id },
        select: { id: true },
      });

      if (!already) {
        await subscriptionsService.issue({
          studentId,
          teacherId,
          pricePlanId: plan.id,
          validFrom: formatLocalDate(today),
          validTo: formatLocalDate(addLocalDays(today, 90)),
          paid: subscription.paid,
        });
      }
    }

    console.log(
      [
        'Seed complete.',
        `  ${LOCATIONS.length} locations, ${DIRECTIONS.length} directions, ${PRICE_PLANS.length} price plans`,
        `  ${TEACHERS.length} teachers with working rules, ${STUDENTS.length} students, 1 admin`,
        `  ${GROUPS.length} groups with members, ${SUBSCRIPTIONS.length} subscription`,
        `  password for every demo account: ${PASSWORD}`,
        `  admin: ${ADMIN.email}   student: ${STUDENTS[0]?.email}`,
      ].join('\n'),
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * `Location` has no natural unique key in the schema - two addresses could
 * share a name in principle - so the seed looks one up by name and falls back
 * to a fresh id, which makes the upsert an insert.
 */
async function idOfLocation(prisma: PrismaClient, name: string): Promise<string> {
  const existing = await prisma.location.findFirst({ where: { name }, select: { id: true } });
  return existing?.id ?? '00000000-0000-7000-8000-000000000000';
}

async function userIdByEmail(prisma: PrismaClient, email: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    throw new Error(`Seed refers to an unknown account: ${email}`);
  }
  return user.id;
}

function required(map: Map<string, string>, key: string): string {
  const value = map.get(key);
  if (!value) {
    throw new Error(`Seed refers to an unknown key: ${key}`);
  }
  return value;
}

function requireDate(value: string) {
  const parsed = parseLocalDate(value);
  if (!parsed) {
    throw new Error(`Seed has a malformed date: ${value}`);
  }
  return parsed;
}

function requireTime(value: string): number {
  const parsed = parseTimeOfDay(value);
  if (parsed === null) {
    throw new Error(`Seed has a malformed time: ${value}`);
  }
  return parsed;
}

await main();

import {
  formatLocalDate,
  isSellableDuration,
  toLocalDate,
  type Subscription,
  type SubscriptionInput,
} from '@palitra/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { Actor } from '../../http/actor';
import { DomainError } from '../../http/error-handler';
import { fromDbDate, requireLocalDate, toDbDate } from '../../lib/calendar-date';

/** Anything that can run a query - the client itself or an open transaction. */
type Db = PrismaClient | Prisma.TransactionClient;

/** The statuses in which a booked lesson still holds a place in the package. */
const RESERVING_STATUSES = ['PENDING', 'CONFIRMED'] as const;

export interface SubscriptionServiceDeps {
  prisma: PrismaClient;
  now?: () => Date;
}

/** What a subscription lesson takes from the package it is booked against. */
export interface ReservedLesson {
  pricePlanId: string;
  durationMinutes: number;
}

export interface SubscriptionService {
  issue(input: SubscriptionInput): Promise<Subscription>;
  listFor(actor: Actor): Promise<Subscription[]>;
  markPaid(subscriptionId: string): Promise<Subscription>;
  cancel(subscriptionId: string): Promise<Subscription>;

  /**
   * Called from inside the booking transaction, which is the only place it
   * makes sense: the answer stops being true the moment the transaction ends.
   */
  reserve(
    tx: Prisma.TransactionClient,
    params: {
      subscriptionId: string;
      studentId: string;
      teacherId: string;
      startsAt: Date;
    },
  ): Promise<ReservedLesson>;

  /** Draws one lesson from the package. Called when a lesson is closed out. */
  draw(tx: Db, subscriptionId: string): Promise<void>;
}

const subscriptionInclude = {
  student: true,
  teacher: { include: { user: true } },
  pricePlan: { include: { direction: true } },
} as const;

export function createSubscriptionService({
  prisma,
  now = () => new Date(),
}: SubscriptionServiceDeps): SubscriptionService {
  async function loadOne(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: subscriptionInclude,
    });

    if (!subscription) {
      throw new DomainError('NOT_FOUND', 'Абонемент не знайдено');
    }
    return subscription;
  }

  /**
   * How many of each package's lessons are already spoken for. Booking does
   * not draw a lesson - that happens when the lesson is closed out - so
   * without counting the lessons already in the calendar a student with eight
   * paid lessons could hold twenty places.
   */
  async function reservedCounts(subscriptionIds: string[]): Promise<Map<string, number>> {
    if (subscriptionIds.length === 0) {
      return new Map();
    }

    const rows = await prisma.lesson.groupBy({
      by: ['subscriptionId'],
      where: { subscriptionId: { in: subscriptionIds }, status: { in: [...RESERVING_STATUSES] } },
      _count: { _all: true },
    });

    const counts = new Map<string, number>();
    for (const row of rows) {
      if (row.subscriptionId) {
        counts.set(row.subscriptionId, row._count._all);
      }
    }
    return counts;
  }

  async function present(rows: SubscriptionRow[]): Promise<Subscription[]> {
    const reserved = await reservedCounts(rows.map((row) => row.id));
    return rows.map((row) => toSubscription(row, reserved.get(row.id) ?? 0));
  }

  async function presentOne(row: SubscriptionRow): Promise<Subscription> {
    const [presented] = await present([row]);
    if (!presented) {
      throw new DomainError('NOT_FOUND', 'Абонемент не знайдено');
    }
    return presented;
  }

  return {
    async issue(input: SubscriptionInput): Promise<Subscription> {
      const [student, teacher, plan] = await Promise.all([
        prisma.user.findUnique({ where: { id: input.studentId } }),
        prisma.teacherProfile.findUnique({ where: { userId: input.teacherId } }),
        prisma.pricePlan.findUnique({ where: { id: input.pricePlanId } }),
      ]);

      if (!student) {
        throw new DomainError('NOT_FOUND', 'Учня не знайдено');
      }
      if (!teacher) {
        throw new DomainError('NOT_FOUND', 'Викладача не знайдено');
      }
      if (!plan || !plan.isActive) {
        throw new DomainError('NOT_FOUND', 'Тариф не знайдено');
      }

      // A package is a run of individual lessons with one teacher; a group
      // course is paid for as a course, not drawn down lesson by lesson.
      if (plan.format !== 'INDIVIDUAL') {
        throw new DomainError('VALIDATION_FAILED', 'Абонемент оформлюється на індивідуальний тариф');
      }
      if (!isSellableDuration(plan.durationMinutes)) {
        throw new DomainError('VALIDATION_FAILED', 'Тариф має некоректну тривалість заняття');
      }

      const created = await prisma.subscription.create({
        data: {
          studentId: student.id,
          teacherId: teacher.userId,
          pricePlanId: plan.id,
          // Read from the plan rather than from the request: a plan of eight
          // lessons recorded as a package of six is a disagreement no screen
          // would catch, and the money is on the other side of it.
          lessonsTotal: plan.lessonsCount,
          priceUah: plan.priceUah,
          validFrom: toDbDate(requireLocalDate(input.validFrom)),
          validTo: toDbDate(requireLocalDate(input.validTo)),
          paidAt: input.paid ? now() : null,
        },
        include: subscriptionInclude,
      });

      return toSubscription(created, 0);
    },

    /**
     * One endpoint for three readings of the same table, from the permission
     * matrix: a student sees their own packages, a teacher those of the people
     * they teach, an admin all of them.
     */
    async listFor(actor: Actor): Promise<Subscription[]> {
      const where =
        actor.role === 'ADMIN'
          ? {}
          : actor.role === 'TEACHER'
            ? { teacherId: actor.userId }
            : { studentId: actor.userId };

      const rows = await prisma.subscription.findMany({
        where,
        include: subscriptionInclude,
        orderBy: [{ validTo: 'desc' }, { createdAt: 'desc' }],
        take: 200,
      });

      return present(rows);
    },

    async markPaid(subscriptionId: string): Promise<Subscription> {
      const subscription = await loadOne(subscriptionId);

      // Paying twice is the same fact, not two of them, so the first date
      // stands - it is the one on the receipt.
      if (subscription.paidAt) {
        return presentOne(subscription);
      }

      const updated = await prisma.subscription.update({
        where: { id: subscription.id },
        data: { paidAt: now() },
        include: subscriptionInclude,
      });

      return presentOne(updated);
    },

    async cancel(subscriptionId: string): Promise<Subscription> {
      const subscription = await loadOne(subscriptionId);

      const updated = await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'CANCELLED' },
        include: subscriptionInclude,
      });

      return presentOne(updated);
    },

    async reserve(tx, { subscriptionId, studentId, teacherId, startsAt }): Promise<ReservedLesson> {
      // `FOR UPDATE` is the point of this query. Two tabs booking the last
      // lesson of a package both read "one left" and both write; the lock
      // makes the second wait until the first has inserted its lesson, so the
      // count it then reads is the true one. Same reasoning as the exclusion
      // constraint on the calendar, applied to the money.
      const rows = await tx.$queryRaw<LockedSubscriptionRow[]>`
        SELECT "id", "studentId", "teacherId", "pricePlanId", "lessonsTotal", "lessonsUsed",
               "validFrom", "validTo", "status"
        FROM "Subscription"
        WHERE "id" = ${subscriptionId}::uuid
        FOR UPDATE
      `;

      const subscription = rows[0];
      if (!subscription) {
        throw new DomainError('NOT_FOUND', 'Абонемент не знайдено');
      }
      if (subscription.studentId !== studentId) {
        throw new DomainError('FORBIDDEN', 'Це чужий абонемент');
      }
      if (subscription.teacherId !== teacherId) {
        throw new DomainError(
          'VALIDATION_FAILED',
          'Абонемент оформлено на іншого викладача студії',
        );
      }
      if (subscription.status !== 'ACTIVE') {
        throw new DomainError('NO_ACTIVE_SUBSCRIPTION', 'Абонемент скасовано');
      }

      // The validity is a range of calendar days, so the lesson's day is what
      // is compared - not the instant, which would move the boundary by the
      // reader's offset.
      const day = formatLocalDate(toLocalDate(startsAt));
      if (
        day < formatLocalDate(fromDbDate(subscription.validFrom)) ||
        day > formatLocalDate(fromDbDate(subscription.validTo))
      ) {
        throw new DomainError('NO_ACTIVE_SUBSCRIPTION', 'Абонемент не діє на цю дату');
      }

      const reserved = await tx.lesson.count({
        where: { subscriptionId, status: { in: [...RESERVING_STATUSES] } },
      });

      if (subscription.lessonsUsed + reserved >= subscription.lessonsTotal) {
        throw new DomainError(
          'SUBSCRIPTION_EXHAUSTED',
          'В абонементі не лишилося занять. Оформіть новий у студії.',
        );
      }

      const plan = await tx.pricePlan.findUnique({ where: { id: subscription.pricePlanId } });
      if (!plan || !isSellableDuration(plan.durationMinutes)) {
        throw new DomainError('NOT_FOUND', 'Тариф абонемента не знайдено');
      }

      return { pricePlanId: plan.id, durationMinutes: plan.durationMinutes };
    },

    async draw(tx, subscriptionId): Promise<void> {
      // One statement rather than read-modify-write, so two lessons closed out
      // at the same moment cannot both read the same count. The
      // `lessonsUsed < lessonsTotal` guard is what stops a bug from drawing a
      // ninth lesson out of eight; `subscription_lessons_range` in the
      // migration is the backstop under it.
      await tx.$executeRaw`
        UPDATE "Subscription"
        SET "lessonsUsed" = "lessonsUsed" + 1, "updatedAt" = now()
        WHERE "id" = ${subscriptionId}::uuid AND "lessonsUsed" < "lessonsTotal"
      `;
    },
  };
}

interface LockedSubscriptionRow {
  id: string;
  studentId: string;
  teacherId: string;
  pricePlanId: string;
  lessonsTotal: number;
  lessonsUsed: number;
  validFrom: Date;
  validTo: Date;
  status: 'ACTIVE' | 'CANCELLED';
}

type SubscriptionRow = Prisma.SubscriptionGetPayload<{ include: typeof subscriptionInclude }>;

function toSubscription(row: SubscriptionRow, lessonsReserved: number): Subscription {
  return {
    id: row.id,
    student: {
      id: row.studentId,
      firstName: row.student.firstName,
      lastName: row.student.lastName,
      phone: row.student.phone,
    },
    teacher: {
      id: row.teacherId,
      firstName: row.teacher.user.firstName,
      lastName: row.teacher.user.lastName,
    },
    directionName: row.pricePlan.direction.name,
    planName: row.pricePlan.name,
    lessonsTotal: row.lessonsTotal,
    lessonsUsed: row.lessonsUsed,
    lessonsReserved,
    lessonsLeft: row.lessonsTotal - row.lessonsUsed - lessonsReserved,
    priceUah: row.priceUah,
    validFrom: formatLocalDate(fromDbDate(row.validFrom)),
    validTo: formatLocalDate(fromDbDate(row.validTo)),
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    status: row.status,
  };
}

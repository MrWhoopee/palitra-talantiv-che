import type { AdminStudent, StudentQuery } from '@palitra/shared';
import type { PrismaClient } from '../../generated/prisma/client.js';

export interface StudentsServiceDeps {
  prisma: PrismaClient;
  now?: () => Date;
}

export interface StudentsService {
  list(query: StudentQuery): Promise<AdminStudent[]>;
}

/**
 * The people the studio teaches.
 *
 * A module of its own rather than a corner of the booking one, because the
 * question it answers is not about lessons: it is "who are we teaching, who
 * owes us for a package, and who has stopped coming". The rows it reads are
 * `User` rows with the student role, which is why there is no table named
 * after it in the schema.
 *
 * Everything here is admin-only by construction - the router is mounted under
 * `/admin` - and there is deliberately no public counterpart. A student is a
 * child with an address and a phone number.
 */
export function createStudentsService({
  prisma,
  now = () => new Date(),
}: StudentsServiceDeps): StudentsService {
  return {
    async list(query: StudentQuery): Promise<AdminStudent[]> {
      const term = query.q?.trim() ?? '';
      const moment = now();

      // One box against three fields. `mode: 'insensitive'` matters for the
      // names: the studio types «шевченко» and the row says «Шевченко».
      const search =
        term === ''
          ? {}
          : {
              OR: [
                { firstName: { contains: term, mode: 'insensitive' as const } },
                { lastName: { contains: term, mode: 'insensitive' as const } },
                { email: { contains: term, mode: 'insensitive' as const } },
                { phone: { contains: term } },
              ],
            };

      const rows = await prisma.user.findMany({
        where: { role: 'STUDENT', ...search },
        include: {
          subscriptions: {
            select: { paidAt: true, validFrom: true, validTo: true },
          },
          // Two slices of the same relation rather than two queries: what is
          // still ahead, and the last thing that happened. A student with a
          // hundred lessons behind them is counted, not loaded.
          lessons: {
            where: { status: { not: 'CANCELLED' } },
            select: { startsAt: true },
            orderBy: { startsAt: 'desc' },
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        take: 200,
      });

      return rows.map((row) => {
        const lessons = row.lessons;
        const live = row.subscriptions.filter(
          (subscription) =>
            subscription.validFrom <= moment &&
            (subscription.validTo === null || subscription.validTo >= moment),
        );

        return {
          id: row.id,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone,
          emailVerified: row.emailVerifiedAt !== null,
          upcomingLessons: lessons.filter((lesson) => lesson.startsAt > moment).length,
          activeSubscriptions: live.length,
          // Unpaid is asked of every package the studio sold, not only the
          // live ones: a package that expired unpaid is still money owed.
          unpaidSubscriptions: row.subscriptions.filter((one) => one.paidAt === null).length,
          lastLessonAt: lastPast(lessons, moment),
        };
      });
    },
  };
}

/** The most recent lesson already behind them, of the rows sorted newest first. */
function lastPast(lessons: { startsAt: Date }[], moment: Date): string | null {
  const past = lessons.find((lesson) => lesson.startsAt <= moment);
  return past ? past.startsAt.toISOString() : null;
}

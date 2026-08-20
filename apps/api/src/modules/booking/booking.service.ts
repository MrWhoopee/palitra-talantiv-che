import {
  formatLocalDate,
  isSellableDuration,
  toLocalDate,
  type BookingRequest,
  type CancelLesson,
  type Lesson,
  type LessonDuration,
} from '@palitra/shared';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import type { Actor } from '../../http/actor';
import { DomainError } from '../../http/error-handler';
import type { Mailer } from '../../lib/mailer';
import { SCHEDULING } from '../availability/availability.config';
import type { AvailabilityService } from '../availability/availability.service';
import type { SubscriptionService } from '../subscriptions/subscriptions.service';
import { BOOKING } from './booking.config';
import {
  buildBookingCancelledMail,
  buildBookingConfirmedMail,
  buildBookingRequestedMail,
  type LessonMailContext,
} from './booking.emails';

const EXCLUSION_VIOLATION = '23P01';

export interface BookingServiceDeps {
  prisma: PrismaClient;
  availability: AvailabilityService;
  subscriptions: SubscriptionService;
  mailer: Mailer;
  /** Where the links in outgoing mail point - the web app, not the API. */
  webOrigin: string;
  now?: () => Date;
  booking?: typeof BOOKING;
  scheduling?: typeof SCHEDULING;
}

export interface BookingService {
  book(actor: Actor, input: BookingRequest): Promise<Lesson>;
  listMyLessons(userId: string): Promise<Lesson[]>;
  confirm(actor: Actor, lessonId: string): Promise<Lesson>;
  cancel(actor: Actor, lessonId: string, input?: CancelLesson): Promise<Lesson>;
  markOutcome(actor: Actor, lessonId: string, status: 'COMPLETED' | 'NO_SHOW'): Promise<Lesson>;
}

const lessonInclude = {
  teacher: { include: { user: true } },
  student: true,
  group: true,
  location: true,
  pricePlan: { include: { direction: true } },
} as const;

/** What fixes a lesson's length and who pays for it. */
interface LessonCharge {
  pricePlanId: string;
  subscriptionId: string | null;
  durationMinutes: LessonDuration;
}

export function createBookingService({
  prisma,
  availability,
  subscriptions,
  mailer,
  webOrigin,
  now = () => new Date(),
  booking = BOOKING,
  scheduling = SCHEDULING,
}: BookingServiceDeps): BookingService {
  const cabinetLink = `${webOrigin.replace(/\/+$/, '')}/cabinet`;

  /**
   * Mail is best effort, exactly as in registration: a relay that is down must
   * not turn a successful booking into a 500 the parent reads as "the studio
   * is broken". Stage 7 replaces these calls with the notification queue.
   */
  async function notify(mail: Parameters<Mailer['send']>[0]): Promise<void> {
    try {
      await mailer.send(mail);
    } catch (error) {
      console.error('Failed to send a lesson mail', error);
    }
  }

  async function loadLesson(lessonId: string) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: lessonInclude,
    });

    if (!lesson) {
      throw new DomainError('NOT_FOUND', 'Заняття не знайдено');
    }
    return lesson;
  }

  type LoadedLesson = Awaited<ReturnType<typeof loadLesson>>;

  /**
   * The ownership half of the permission check. `requireRole` cannot do this:
   * a role says "a teacher", not "this lesson's teacher", and without the
   * second half teacher A confirms teacher B's lessons by sending B's id.
   */
  function assertTeacherSide(lesson: LoadedLesson, actor: Actor): void {
    if (actor.role !== 'ADMIN' && lesson.teacherId !== actor.userId) {
      throw new DomainError('NOT_TEACHER_OWNED', 'Це заняття іншого викладача');
    }
  }

  function assertParty(lesson: LoadedLesson, actor: Actor): void {
    const involved = lesson.teacherId === actor.userId || lesson.studentId === actor.userId;
    if (actor.role !== 'ADMIN' && !involved) {
      throw new DomainError('FORBIDDEN', 'Це заняття вас не стосується');
    }
  }

  function mailContextFor(
    lesson: LoadedLesson,
    recipient: { email: string; firstName: string },
    studentName: string,
  ): LessonMailContext {
    return {
      to: recipient.email,
      firstName: recipient.firstName,
      teacherName: `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}`,
      studentName,
      startsAt: lesson.startsAt,
      durationMinutes: lesson.durationMinutes,
      locationName: lesson.location.name,
      locationAddress: lesson.location.address,
      link: cabinetLink,
    };
  }

  return {
    async book(actor: Actor, input: BookingRequest): Promise<Lesson> {
      const student = await prisma.user.findUnique({ where: { id: actor.userId } });
      if (!student) {
        throw new DomainError('NOT_FOUND', 'Користувача не знайдено');
      }

      const moment = now();
      const startsAt = new Date(input.startsAt);
      const horizonEnd = new Date(
        moment.getTime() + scheduling.bookingHorizonDays * 24 * 60 * 60 * 1000,
      );

      if (startsAt <= moment) {
        throw new DomainError('OUTSIDE_BOOKING_HORIZON', 'Цей час уже минув');
      }
      if (startsAt > horizonEnd) {
        throw new DomainError(
          'OUTSIDE_BOOKING_HORIZON',
          `Записатися можна не далі ніж на ${scheduling.bookingHorizonDays} днів уперед`,
        );
      }

      const previousLessons = await prisma.lesson.count({
        where: { studentId: student.id, status: { not: 'CANCELLED' } },
      });

      // The first booking works with an unconfirmed address on purpose - half
      // the signups would otherwise die on "check your inbox". From the second
      // one on, a working address is required, because that is where the
      // reminders go.
      if (previousLessons > 0 && !student.emailVerifiedAt) {
        throw new DomainError(
          'EMAIL_NOT_VERIFIED',
          'Підтвердіть пошту, щоб записатися ще раз — ми надсилаємо на неї нагадування',
        );
      }

      if (input.kind === 'TRIAL') {
        // One free trial per student for good, not per teacher. A cancelled
        // trial gives the right back: an accidental cancellation must not cost
        // someone their only free lesson.
        const usedTrial = await prisma.lesson.count({
          where: { studentId: student.id, kind: 'TRIAL', status: { not: 'CANCELLED' } },
        });
        if (usedTrial > 0) {
          throw new DomainError(
            'TRIAL_ALREADY_USED',
            'Безкоштовне пробне заняття можна відвідати один раз',
          );
        }
      }

      let lessonId: string;
      try {
        // Everything that decides whether this booking may exist happens in
        // one transaction: a package with one lesson left, opened in two tabs,
        // is settled by the row lock inside `reserve`, and a slot two families
        // want is settled by the exclusion constraint on the insert.
        //
        // Nothing inside reads relations. Prisma answers an `include` with
        // several queries at once, and a transaction has a single connection
        // to answer them on - the presentation read happens afterwards.
        const created = await prisma.$transaction(async (tx) => {
          const charge = await resolveCharge(tx, input, student.id, startsAt);
          await assertSlotIsOffered(input, charge.durationMinutes, startsAt);

          return tx.lesson.create({
            data: {
              teacherId: input.teacherId,
              studentId: student.id,
              locationId: input.locationId,
              pricePlanId: charge.pricePlanId,
              subscriptionId: charge.subscriptionId,
              startsAt,
              endsAt: new Date(startsAt.getTime() + charge.durationMinutes * 60_000),
              durationMinutes: charge.durationMinutes,
              kind: input.kind,
              status: 'PENDING',
            },
            select: { id: true },
          });
        });

        lessonId = created.id;
      } catch (error) {
        // The exclusion constraint is what actually decides who got the slot;
        // the check above only saves the loser a wasted round trip.
        if (isOverlapViolation(error)) {
          throw new DomainError('SLOT_TAKEN', 'Цей час щойно зайняли. Оберіть інший.');
        }
        throw error;
      }

      const created = await loadLesson(lessonId);

      await notify(
        buildBookingRequestedMail(
          mailContextFor(
            created,
            {
              email: created.teacher.user.email,
              firstName: created.teacher.user.firstName,
            },
            `${student.firstName} ${student.lastName}`,
          ),
        ),
      );

      return toLesson(created);
    },

    async listMyLessons(userId: string): Promise<Lesson[]> {
      const lessons = await prisma.lesson.findMany({
        // One query for both cabinets: a person sees the lessons they are a
        // party to, whichever side of them they are on. The third arm is what
        // puts a group's meetings into the cabinets of the people in it -
        // those lessons name the group, not the student.
        where: {
          OR: [
            { studentId: userId },
            { teacherId: userId },
            { group: { enrollments: { some: { studentId: userId, status: 'ACTIVE' } } } },
          ],
        },
        include: lessonInclude,
        orderBy: { startsAt: 'asc' },
        take: 500,
      });

      return lessons.map(toLesson);
    },

    async confirm(actor: Actor, lessonId: string): Promise<Lesson> {
      const lesson = await loadLesson(lessonId);
      assertTeacherSide(lesson, actor);

      if (lesson.status !== 'PENDING') {
        throw new DomainError(
          'INVALID_LESSON_STATUS',
          'Підтвердити можна лише заняття в очікуванні',
        );
      }

      const updated = await prisma.lesson.update({
        where: { id: lesson.id },
        data: { status: 'CONFIRMED' },
        include: lessonInclude,
      });

      if (updated.student) {
        await notify(
          buildBookingConfirmedMail(
            mailContextFor(
              updated,
              { email: updated.student.email, firstName: updated.student.firstName },
              `${updated.student.firstName} ${updated.student.lastName}`,
            ),
          ),
        );
      }

      return toLesson(updated);
    },

    async cancel(actor: Actor, lessonId: string, input: CancelLesson = {}): Promise<Lesson> {
      const lesson = await loadLesson(lessonId);
      assertParty(lesson, actor);

      if (lesson.status !== 'PENDING' && lesson.status !== 'CONFIRMED') {
        throw new DomainError('INVALID_LESSON_STATUS', 'Це заняття вже не можна скасувати');
      }

      const isStudentCancelling =
        actor.role !== 'ADMIN' &&
        lesson.studentId === actor.userId &&
        lesson.teacherId !== actor.userId;

      const isLate = lesson.startsAt.getTime() - now().getTime() < booking.cancellationWindowMs;

      // The 24-hour rule is enforced here rather than by hiding the button:
      // the button is not the only way to reach this, and for the mobile
      // client the server is the only guard there is.
      if (isStudentCancelling && isLate) {
        throw new DomainError(
          'TOO_LATE_TO_CANCEL',
          'Скасувати самостійно можна не пізніше ніж за 24 години. Зателефонуйте викладачу.',
        );
      }

      // A lesson called off inside the last day is still the teacher's held
      // hour, so it comes out of the package - that is the rule the 24 hours
      // exist to express. `waiveCharge` is its other half: a late cancellation
      // now goes through the teacher, and the teacher is the one who knows
      // whether it was the child who fell ill or the studio.
      const chargesPackage = lesson.subscriptionId !== null && isLate && input.waiveCharge !== true;

      await prisma.$transaction(async (tx) => {
        await tx.lesson.update({
          where: { id: lesson.id },
          data: {
            status: 'CANCELLED',
            cancelledById: actor.userId,
            cancelReason: input.reason?.trim() ? input.reason.trim() : null,
          },
          select: { id: true },
        });

        if (chargesPackage && lesson.subscriptionId) {
          await subscriptions.draw(tx, lesson.subscriptionId);
        }
      });

      const updated = await loadLesson(lesson.id);

      // The other side is told; whoever pressed the button already knows. A
      // group meeting has no single student to write to - reaching a whole
      // register is what stage 7's queue is for.
      if (updated.student) {
        const recipient = isStudentCancelling
          ? { email: updated.teacher.user.email, firstName: updated.teacher.user.firstName }
          : { email: updated.student.email, firstName: updated.student.firstName };

        await notify(
          buildBookingCancelledMail({
            ...mailContextFor(
              updated,
              recipient,
              `${updated.student.firstName} ${updated.student.lastName}`,
            ),
            reason: updated.cancelReason,
          }),
        );
      }

      return toLesson(updated);
    },

    async markOutcome(
      actor: Actor,
      lessonId: string,
      status: 'COMPLETED' | 'NO_SHOW',
    ): Promise<Lesson> {
      const lesson = await loadLesson(lessonId);
      assertTeacherSide(lesson, actor);

      if (lesson.status !== 'CONFIRMED') {
        throw new DomainError(
          'INVALID_LESSON_STATUS',
          'Позначити результат можна лише для підтвердженого заняття',
        );
      }

      // This mark draws a lesson from the package, so it must not be
      // reachable before the lesson has actually begun.
      if (lesson.startsAt > now()) {
        throw new DomainError('INVALID_LESSON_STATUS', 'Заняття ще не почалося');
      }

      // "Nobody came" is not something a group does: the register says who was
      // there, one child at a time.
      if (lesson.groupId && status === 'NO_SHOW') {
        throw new DomainError(
          'INVALID_LESSON_STATUS',
          'У груповому занятті відсутність відмічається в журналі',
        );
      }

      await prisma.$transaction(async (tx) => {
        // The status is part of the filter, not only of the data: two clicks
        // arriving together would otherwise both succeed and draw the lesson
        // from the package twice.
        const changed = await tx.lesson.updateMany({
          where: { id: lesson.id, status: 'CONFIRMED' },
          data: { status },
        });

        if (changed.count === 0) {
          throw new DomainError('INVALID_LESSON_STATUS', 'Результат уже позначено');
        }

        // A missed lesson is charged exactly like an attended one: the hour
        // was held and the teacher was there.
        if (lesson.subscriptionId) {
          await subscriptions.draw(tx, lesson.subscriptionId);
        }
      });

      return toLesson(await loadLesson(lesson.id));
    },
  };

  /**
   * What the lesson costs and how long it runs. A trial or a single lesson
   * names a price plan; a subscription lesson names the package, and both the
   * length and the plan come from what that package was sold against - so the
   * two can never disagree.
   */
  async function resolveCharge(
    tx: Prisma.TransactionClient,
    input: BookingRequest,
    studentId: string,
    startsAt: Date,
  ): Promise<LessonCharge> {
    if (input.kind === 'SUBSCRIPTION') {
      if (!input.subscriptionId) {
        throw new DomainError('VALIDATION_FAILED', 'Не вказано абонемент');
      }

      const reserved = await subscriptions.reserve(tx, {
        subscriptionId: input.subscriptionId,
        studentId,
        teacherId: input.teacherId,
        startsAt,
      });

      return {
        pricePlanId: reserved.pricePlanId,
        subscriptionId: input.subscriptionId,
        durationMinutes: reserved.durationMinutes as LessonDuration,
      };
    }

    if (!input.pricePlanId) {
      throw new DomainError('VALIDATION_FAILED', 'Не вказано тариф');
    }

    const plan = await tx.pricePlan.findUnique({ where: { id: input.pricePlanId } });
    if (!plan || !plan.isActive) {
      throw new DomainError('NOT_FOUND', 'Тариф не знайдено');
    }
    if (plan.format !== 'INDIVIDUAL') {
      throw new DomainError('VALIDATION_FAILED', 'До групи записуються заявкою, а не на слот');
    }
    if (!isSellableDuration(plan.durationMinutes)) {
      throw new DomainError('VALIDATION_FAILED', 'Тариф має некоректну тривалість заняття');
    }

    return {
      pricePlanId: plan.id,
      subscriptionId: null,
      durationMinutes: plan.durationMinutes as LessonDuration,
    };
  }

  /**
   * The requested instant has to be one the slot endpoint actually offered -
   * same teacher, same address, same grid. Asking the availability service
   * rather than re-deriving it here means the calendar the visitor saw and the
   * rule the booking applies are the same code.
   */
  async function assertSlotIsOffered(
    input: BookingRequest,
    durationMinutes: LessonDuration,
    startsAt: Date,
  ): Promise<void> {
    const day = formatLocalDate(toLocalDate(startsAt));
    const offered = await availability.getSlots(input.teacherId, {
      from: day,
      to: day,
      duration: durationMinutes,
    });

    const match = offered.slots.some(
      (slot) =>
        new Date(slot.startsAt).getTime() === startsAt.getTime() &&
        slot.locationId === input.locationId,
    );

    if (!match) {
      throw new DomainError('SLOT_TAKEN', 'Цей час недоступний. Оберіть інший зі списку вільних.');
    }
  }
}

type LessonRow = Prisma.LessonGetPayload<{ include: typeof lessonInclude }>;

function toLesson(lesson: LessonRow): Lesson {
  return {
    id: lesson.id,
    startsAt: lesson.startsAt.toISOString(),
    endsAt: lesson.endsAt.toISOString(),
    durationMinutes: lesson.durationMinutes,
    kind: lesson.kind,
    status: lesson.status,
    cancelReason: lesson.cancelReason,
    teacher: {
      id: lesson.teacherId,
      firstName: lesson.teacher.user.firstName,
      lastName: lesson.teacher.user.lastName,
    },
    student: lesson.student
      ? {
          id: lesson.student.id,
          firstName: lesson.student.firstName,
          lastName: lesson.student.lastName,
          phone: lesson.student.phone,
        }
      : null,
    group: lesson.group ? { id: lesson.group.id, name: lesson.group.name } : null,
    location: {
      id: lesson.locationId,
      name: lesson.location.name,
      address: lesson.location.address,
    },
    directionName: lesson.pricePlan?.direction.name ?? null,
    subscriptionId: lesson.subscriptionId,
  };
}

/**
 * Postgres reports an exclusion constraint violation as SQLSTATE 23P01. Prisma
 * has no dedicated error code for it, so the raw state is what identifies it -
 * matched alongside the constraint name so a future exclusion constraint on
 * another table cannot be mistaken for this one.
 */
export function isOverlapViolation(error: unknown): boolean {
  const text = serialise(error);
  return text.includes(EXCLUSION_VIOLATION) || text.includes('lesson_no_overlap');
}

function serialise(error: unknown): string {
  if (error instanceof Error) {
    const meta =
      error instanceof Prisma.PrismaClientKnownRequestError ? JSON.stringify(error.meta) : '';
    return `${error.message} ${meta}`;
  }
  return String(error);
}

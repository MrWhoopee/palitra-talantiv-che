import {
  formatLocalDate,
  isSellableDuration,
  toLocalDate,
  type BookingRequest,
  type Lesson,
  type LessonDuration,
  type UserRole,
} from '@palitra/shared';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { DomainError } from '../../http/error-handler';
import type { Mailer } from '../../lib/mailer';
import { SCHEDULING } from '../availability/availability.config';
import type { AvailabilityService } from '../availability/availability.service';
import { BOOKING } from './booking.config';
import {
  buildBookingCancelledMail,
  buildBookingConfirmedMail,
  buildBookingRequestedMail,
  type LessonMailContext,
} from './booking.emails';

const EXCLUSION_VIOLATION = '23P01';

/** Who is asking. The role comes from the token, the id from the same claims. */
export interface Actor {
  userId: string;
  role: UserRole;
}

export interface BookingServiceDeps {
  prisma: PrismaClient;
  availability: AvailabilityService;
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
  cancel(actor: Actor, lessonId: string, reason?: string): Promise<Lesson>;
  markOutcome(actor: Actor, lessonId: string, status: 'COMPLETED' | 'NO_SHOW'): Promise<Lesson>;
}

const lessonInclude = {
  teacher: { include: { user: true } },
  student: true,
  location: true,
  pricePlan: { include: { direction: true } },
} as const;

export function createBookingService({
  prisma,
  availability,
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
  ): LessonMailContext {
    return {
      to: recipient.email,
      firstName: recipient.firstName,
      teacherName: `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}`,
      studentName: `${lesson.student.firstName} ${lesson.student.lastName}`,
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

      const plan = await prisma.pricePlan.findUnique({ where: { id: input.pricePlanId } });
      if (!plan || !plan.isActive) {
        throw new DomainError('NOT_FOUND', 'Тариф не знайдено');
      }
      if (plan.format !== 'INDIVIDUAL') {
        throw new DomainError('VALIDATION_FAILED', 'Запис у групу відкриється на наступному етапі');
      }
      if (!isSellableDuration(plan.durationMinutes)) {
        throw new DomainError('VALIDATION_FAILED', 'Тариф має некоректну тривалість заняття');
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

      await assertSlotIsOffered(input, plan.durationMinutes as LessonDuration, startsAt);

      const endsAt = new Date(startsAt.getTime() + plan.durationMinutes * 60_000);

      let created;
      try {
        created = await prisma.lesson.create({
          data: {
            teacherId: input.teacherId,
            studentId: student.id,
            locationId: input.locationId,
            pricePlanId: plan.id,
            startsAt,
            endsAt,
            durationMinutes: plan.durationMinutes,
            kind: input.kind,
            status: 'PENDING',
          },
          include: lessonInclude,
        });
      } catch (error) {
        // The exclusion constraint is what actually decides who got the slot;
        // the check above only saves the loser a wasted round trip.
        if (isOverlapViolation(error)) {
          throw new DomainError('SLOT_TAKEN', 'Цей час щойно зайняли. Оберіть інший.');
        }
        throw error;
      }

      await notify(
        buildBookingRequestedMail(
          mailContextFor(created, {
            email: created.teacher.user.email,
            firstName: created.teacher.user.firstName,
          }),
        ),
      );

      return toLesson(created);
    },

    async listMyLessons(userId: string): Promise<Lesson[]> {
      const lessons = await prisma.lesson.findMany({
        // One query for both cabinets: a person sees the lessons they are a
        // party to, whichever side of them they are on.
        where: { OR: [{ studentId: userId }, { teacherId: userId }] },
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

      await notify(
        buildBookingConfirmedMail(
          mailContextFor(updated, {
            email: updated.student.email,
            firstName: updated.student.firstName,
          }),
        ),
      );

      return toLesson(updated);
    },

    async cancel(actor: Actor, lessonId: string, reason?: string): Promise<Lesson> {
      const lesson = await loadLesson(lessonId);
      assertParty(lesson, actor);

      if (lesson.status !== 'PENDING' && lesson.status !== 'CONFIRMED') {
        throw new DomainError('INVALID_LESSON_STATUS', 'Це заняття вже не можна скасувати');
      }

      const isStudentCancelling =
        actor.role !== 'ADMIN' &&
        lesson.studentId === actor.userId &&
        lesson.teacherId !== actor.userId;

      // The 24-hour rule is enforced here rather than by hiding the button:
      // the button is not the only way to reach this, and for the mobile
      // client the server is the only guard there is.
      if (
        isStudentCancelling &&
        lesson.startsAt.getTime() - now().getTime() < booking.cancellationWindowMs
      ) {
        throw new DomainError(
          'TOO_LATE_TO_CANCEL',
          'Скасувати самостійно можна не пізніше ніж за 24 години. Зателефонуйте викладачу.',
        );
      }

      const updated = await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          status: 'CANCELLED',
          cancelledById: actor.userId,
          cancelReason: reason?.trim() ? reason.trim() : null,
        },
        include: lessonInclude,
      });

      // The other side is told; whoever pressed the button already knows.
      const recipient = isStudentCancelling
        ? { email: updated.teacher.user.email, firstName: updated.teacher.user.firstName }
        : { email: updated.student.email, firstName: updated.student.firstName };

      await notify(
        buildBookingCancelledMail({
          ...mailContextFor(updated, recipient),
          reason: updated.cancelReason,
        }),
      );

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

      // This mark is what will draw a lesson from a subscription in stage 4,
      // so it must not be reachable before the lesson has actually begun.
      if (lesson.startsAt > now()) {
        throw new DomainError('INVALID_LESSON_STATUS', 'Заняття ще не почалося');
      }

      const updated = await prisma.lesson.update({
        where: { id: lesson.id },
        data: { status },
        include: lessonInclude,
      });

      return toLesson(updated);
    },
  };

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
    student: {
      id: lesson.studentId,
      firstName: lesson.student.firstName,
      lastName: lesson.student.lastName,
      phone: lesson.student.phone,
    },
    location: {
      id: lesson.locationId,
      name: lesson.location.name,
      address: lesson.location.address,
    },
    directionName: lesson.pricePlan?.direction.name ?? null,
  };
}

/**
 * Postgres reports an exclusion constraint violation as SQLSTATE 23P01. Prisma
 * has no dedicated error code for it, so the raw state is what identifies it -
 * matched alongside the constraint name so a future exclusion constraint on
 * another table cannot be mistaken for this one.
 */
function isOverlapViolation(error: unknown): boolean {
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

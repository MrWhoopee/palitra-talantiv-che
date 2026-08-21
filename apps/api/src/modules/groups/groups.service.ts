import {
  formatLocalDate,
  formatTimeOfDay,
  parseTimeOfDay,
  type AdminEnrollment,
  type AttendanceUpdate,
  type EnrollmentQuery,
  type Group,
  type GroupEnrollment,
  type GroupInput,
  type GroupEnrollmentStatus,
  type GroupSaveResult,
  type LessonAttendance,
  type LessonStatus,
} from '@palitra/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { Actor } from '../../http/actor';
import { DomainError } from '../../http/error-handler';
import { fromDbDate, requireLocalDate, toDbDate } from '../../lib/calendar-date';
import { isOverlapViolation } from '../booking/booking.service';
import { GROUPS } from './groups.config';
import { computeGroupLessons } from './compute-group-lessons';

/** The statuses in which an application still holds a place in the group. */
const OCCUPYING: GroupEnrollmentStatus[] = ['PENDING', 'ACTIVE'];

/**
 * The statuses in which a meeting still holds the teacher's time - the same
 * set the `lesson_no_overlap` constraint is defined over.
 */
const HOLDING: LessonStatus[] = ['PENDING', 'CONFIRMED'];

export interface GroupsServiceDeps {
  prisma: PrismaClient;
  now?: () => Date;
  groups?: typeof GROUPS;
}

export interface GroupsService {
  listOpen(): Promise<Group[]>;
  get(groupId: string): Promise<Group>;
  listForActor(actor: Actor): Promise<Group[]>;
  create(actor: Actor, input: GroupInput): Promise<GroupSaveResult>;
  update(actor: Actor, groupId: string, input: GroupInput): Promise<GroupSaveResult>;
  listEnrollments(actor: Actor, groupId: string): Promise<GroupEnrollment[]>;
  /**
   * Every application in the studio, whichever group it is to.
   *
   * Read the other way round from `listEnrollments`: there the group is known
   * and the people are the answer, here the people are what is being looked
   * at and the group is part of describing each one. That is why this returns
   * a shape with the group folded in rather than the same rows again.
   */
  listAllEnrollments(query: EnrollmentQuery): Promise<AdminEnrollment[]>;
  apply(actor: Actor, groupId: string): Promise<GroupEnrollment>;
  approve(actor: Actor, enrollmentId: string): Promise<GroupEnrollment>;
  remove(actor: Actor, enrollmentId: string): Promise<GroupEnrollment>;
  getAttendance(actor: Actor, lessonId: string): Promise<LessonAttendance>;
  setAttendance(actor: Actor, lessonId: string, input: AttendanceUpdate): Promise<LessonAttendance>;
}

const groupInclude = {
  teacher: { include: { user: true } },
  direction: true,
  location: true,
  schedule: true,
  _count: { select: { enrollments: { where: { status: { in: OCCUPYING } } } } },
} as const;

const enrollmentInclude = { student: true } as const;

export function createGroupsService({
  prisma,
  now = () => new Date(),
  groups = GROUPS,
}: GroupsServiceDeps): GroupsService {
  async function loadGroup(groupId: string) {
    const group = await prisma.group.findUnique({ where: { id: groupId }, include: groupInclude });
    if (!group) {
      throw new DomainError('NOT_FOUND', 'Групу не знайдено');
    }
    return group;
  }

  /**
   * A role says "a teacher", not "this group's teacher". Without the second
   * half a teacher would approve applications to a colleague's group by
   * sending its id.
   */
  function assertOwner(teacherId: string, actor: Actor): void {
    if (actor.role !== 'ADMIN' && teacherId !== actor.userId) {
      throw new DomainError('NOT_TEACHER_OWNED', 'Це група іншого викладача');
    }
  }

  function teacherIdFor(actor: Actor, input: GroupInput): string {
    if (actor.role === 'ADMIN') {
      const teacherId = input.teacherId ?? actor.userId;
      return teacherId;
    }

    if (input.teacherId && input.teacherId !== actor.userId) {
      throw new DomainError('NOT_TEACHER_OWNED', 'Групу можна створити лише собі');
    }
    return actor.userId;
  }

  /**
   * Turns the group's timetable into real lessons.
   *
   * Deliberately not one transaction. A meeting can collide with an individual
   * lesson the teacher already has, and in Postgres a constraint violation
   * aborts the whole transaction - one bad Tuesday would take the other
   * fifteen with it. So the collisions are found by reading first, the
   * remaining meetings are inserted one by one, and the exclusion constraint
   * stays as the backstop for a booking that lands in between.
   */
  async function regenerate(group: GroupRow): Promise<{ generated: number; skipped: string[] }> {
    const moment = now();

    // Past meetings are history and keep their registers; only what has not
    // happened yet is rebuilt from the timetable.
    await prisma.lesson.deleteMany({
      where: { groupId: group.id, startsAt: { gt: moment }, status: { in: HOLDING } },
    });

    const planned = computeGroupLessons({
      schedule: group.schedule.map((entry) => ({
        weekday: entry.weekday,
        startMinute: entry.startMinute,
      })),
      startsOn: fromDbDate(group.startsOn),
      endsOn: group.endsOn ? fromDbDate(group.endsOn) : null,
      durationMinutes: group.durationMinutes,
      from: moment,
      horizonDays: groups.generationHorizonDays,
    });

    if (planned.length === 0) {
      return { generated: 0, skipped: [] };
    }

    const busy = await prisma.lesson.findMany({
      where: {
        teacherId: group.teacherId,
        status: { in: HOLDING },
        startsAt: { lt: planned[planned.length - 1]!.endsAt },
        endsAt: { gt: planned[0]!.startsAt },
      },
      select: { startsAt: true, endsAt: true },
    });

    let generated = 0;
    const skipped: string[] = [];

    for (const meeting of planned) {
      const collides = busy.some(
        (lesson) => lesson.startsAt < meeting.endsAt && lesson.endsAt > meeting.startsAt,
      );

      if (collides) {
        skipped.push(meeting.startsAt.toISOString());
        continue;
      }

      try {
        await prisma.lesson.create({
          data: {
            teacherId: group.teacherId,
            groupId: group.id,
            locationId: group.locationId,
            startsAt: meeting.startsAt,
            endsAt: meeting.endsAt,
            durationMinutes: group.durationMinutes,
            // A group course is paid for as a course. `kind` says how the
            // lesson is paid for, `groupId` says who it is for - the two are
            // separate questions, and this one has no package behind it.
            kind: 'SINGLE',
            // Not PENDING: a group's meeting is not a request waiting for the
            // teacher's answer, it is the timetable they wrote themselves.
            status: 'CONFIRMED',
          },
        });
        generated += 1;
      } catch (error) {
        if (!isOverlapViolation(error)) {
          throw error;
        }
        skipped.push(meeting.startsAt.toISOString());
      }
    }

    return { generated, skipped };
  }

  async function saveResult(groupId: string, generated: number, skipped: string[]) {
    return {
      group: toGroup(await loadGroup(groupId)),
      generatedLessons: generated,
      skippedOccurrences: skipped,
    };
  }

  function groupData(input: GroupInput) {
    return {
      name: input.name,
      directionId: input.directionId,
      locationId: input.locationId,
      capacity: input.capacity,
      durationMinutes: input.durationMinutes,
      isOpenForEnrollment: input.isOpenForEnrollment ?? true,
      startsOn: toDbDate(requireLocalDate(input.startsOn)),
      endsOn: input.endsOn ? toDbDate(requireLocalDate(input.endsOn)) : null,
    };
  }

  function scheduleData(input: GroupInput) {
    return input.schedule.map((entry) => ({
      weekday: entry.weekday,
      startMinute: parseTimeOfDay(entry.startTime) ?? 0,
    }));
  }

  async function loadEnrollment(enrollmentId: string) {
    const enrollment = await prisma.groupEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { ...enrollmentInclude, group: { select: { teacherId: true, capacity: true } } },
    });

    if (!enrollment) {
      throw new DomainError('NOT_FOUND', 'Заявку не знайдено');
    }
    return enrollment;
  }

  /** A group lesson the caller is entitled to keep the register for. */
  async function loadGroupLesson(actor: Actor, lessonId: string) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { group: true },
    });

    if (!lesson || !lesson.group) {
      throw new DomainError('NOT_FOUND', 'Групове заняття не знайдено');
    }

    assertOwner(lesson.teacherId, actor);
    return { lesson, group: lesson.group };
  }

  async function readRegister(
    lessonId: string,
    group: { id: string; name: string },
    startsAt: Date,
  ): Promise<LessonAttendance> {
    const [members, marks] = await Promise.all([
      prisma.groupEnrollment.findMany({
        where: { groupId: group.id, status: 'ACTIVE' },
        include: enrollmentInclude,
        orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
      }),
      prisma.lessonAttendance.findMany({ where: { lessonId } }),
    ]);

    const byStudent = new Map(marks.map((mark) => [mark.studentId, mark.status]));

    return {
      lessonId,
      groupId: group.id,
      groupName: group.name,
      startsAt: startsAt.toISOString(),
      // Every active member appears, marked or not: a register with rows
      // missing is one where the teacher cannot tell whom they forgot.
      entries: members.map((member) => ({
        student: {
          id: member.studentId,
          firstName: member.student.firstName,
          lastName: member.student.lastName,
          phone: member.student.phone,
        },
        status: byStudent.get(member.studentId) ?? null,
      })),
    };
  }

  return {
    async listOpen(): Promise<Group[]> {
      const rows = await prisma.group.findMany({
        where: { isOpenForEnrollment: true },
        include: groupInclude,
        orderBy: [{ startsOn: 'asc' }, { name: 'asc' }],
        take: 100,
      });

      return rows.map(toGroup);
    },

    async get(groupId: string): Promise<Group> {
      return toGroup(await loadGroup(groupId));
    },

    /**
     * A teacher sees the groups they run, a student the ones they belong to or
     * have applied for, an admin all of them - the permission matrix read as
     * three filters over one table.
     */
    async listForActor(actor: Actor): Promise<Group[]> {
      const where =
        actor.role === 'ADMIN'
          ? {}
          : actor.role === 'TEACHER'
            ? { teacherId: actor.userId }
            : {
                enrollments: {
                  some: { studentId: actor.userId, status: { in: OCCUPYING } },
                },
              };

      const rows = await prisma.group.findMany({
        where,
        include: groupInclude,
        orderBy: [{ startsOn: 'asc' }, { name: 'asc' }],
        take: 100,
      });

      return rows.map(toGroup);
    },

    async create(actor: Actor, input: GroupInput): Promise<GroupSaveResult> {
      const teacherId = teacherIdFor(actor, input);

      const teacher = await prisma.teacherProfile.findUnique({ where: { userId: teacherId } });
      if (!teacher) {
        throw new DomainError('NOT_FOUND', 'Викладача не знайдено');
      }

      const created = await prisma.group.create({
        data: {
          teacherId,
          ...groupData(input),
          schedule: { create: scheduleData(input) },
        },
        include: groupInclude,
      });

      const { generated, skipped } = await regenerate(created);
      return saveResult(created.id, generated, skipped);
    },

    async update(actor: Actor, groupId: string, input: GroupInput): Promise<GroupSaveResult> {
      const group = await loadGroup(groupId);
      assertOwner(group.teacherId, actor);

      // The timetable is replaced wholesale rather than diffed: a set of
      // weekday-and-hour pairs has no identity worth preserving, and the
      // meetings it produces are regenerated either way.
      const updated = await prisma.group.update({
        where: { id: group.id },
        data: {
          ...groupData(input),
          schedule: { deleteMany: {}, create: scheduleData(input) },
        },
        include: groupInclude,
      });

      const { generated, skipped } = await regenerate(updated);
      return saveResult(updated.id, generated, skipped);
    },

    async listEnrollments(actor: Actor, groupId: string): Promise<GroupEnrollment[]> {
      const group = await loadGroup(groupId);
      assertOwner(group.teacherId, actor);

      const rows = await prisma.groupEnrollment.findMany({
        where: { groupId, status: { in: OCCUPYING } },
        include: enrollmentInclude,
        orderBy: [{ status: 'asc' }, { joinedAt: 'asc' }],
      });

      return rows.map(toEnrollment);
    },

    async listAllEnrollments(query: EnrollmentQuery): Promise<AdminEnrollment[]> {
      const rows = await prisma.groupEnrollment.findMany({
        // No status means the ones that still hold a place. A studio opening
        // this screen is looking at who is waiting and who is in, not at the
        // history of everyone who ever left.
        where: { status: query.status ? query.status : { in: OCCUPYING } },
        include: {
          ...enrollmentInclude,
          group: { include: { teacher: { include: { user: true } } } },
        },
        // Waiting first, and the longest wait at the top of it: the screen
        // exists to be worked through from the top down.
        orderBy: [{ status: 'asc' }, { joinedAt: 'asc' }],
        take: 500,
      });

      return rows.map((row) => ({
        ...toEnrollment(row),
        studentEmail: row.student.email,
        group: {
          id: row.group.id,
          name: row.group.name,
          teacherName: `${row.group.teacher.user.firstName} ${row.group.teacher.user.lastName}`,
        },
      }));
    },

    async apply(actor: Actor, groupId: string): Promise<GroupEnrollment> {
      const group = await loadGroup(groupId);

      if (!group.isOpenForEnrollment) {
        throw new DomainError('VALIDATION_FAILED', 'Набір до цієї групи закрито');
      }

      const existing = await prisma.groupEnrollment.findUnique({
        where: { groupId_studentId: { groupId, studentId: actor.userId } },
        include: enrollmentInclude,
      });

      if (existing && existing.status !== 'LEFT') {
        throw new DomainError(
          'ALREADY_ENROLLED',
          existing.status === 'PENDING' ? 'Заявку вже подано' : 'Ви вже в цій групі',
        );
      }

      // Pending applications count against the capacity: a place is held while
      // the teacher decides, otherwise nine people get approved into eight
      // chairs and someone is told to go home.
      const taken = await prisma.groupEnrollment.count({
        where: { groupId, status: { in: OCCUPYING } },
      });

      if (taken >= group.capacity) {
        throw new DomainError('GROUP_FULL', 'У групі немає вільних місць');
      }

      // Someone who left and came back reuses their row - the unique index on
      // the pair is what makes a second application impossible.
      const enrollment = existing
        ? await prisma.groupEnrollment.update({
            where: { id: existing.id },
            data: { status: 'PENDING', joinedAt: now(), leftAt: null },
            include: enrollmentInclude,
          })
        : await prisma.groupEnrollment.create({
            data: { groupId, studentId: actor.userId },
            include: enrollmentInclude,
          });

      return toEnrollment(enrollment);
    },

    async approve(actor: Actor, enrollmentId: string): Promise<GroupEnrollment> {
      const enrollment = await loadEnrollment(enrollmentId);
      assertOwner(enrollment.group.teacherId, actor);

      if (enrollment.status !== 'PENDING') {
        throw new DomainError('VALIDATION_FAILED', 'Цю заявку вже розглянуто');
      }

      const updated = await prisma.groupEnrollment.update({
        where: { id: enrollment.id },
        data: { status: 'ACTIVE', leftAt: null },
        include: enrollmentInclude,
      });

      return toEnrollment(updated);
    },

    /**
     * One operation for three situations - a declined application, a student
     * the teacher takes off the register, a student who leaves. All three end
     * with the place given back, which is the only thing the group cares
     * about; `joinedAt` and `leftAt` keep the story.
     */
    async remove(actor: Actor, enrollmentId: string): Promise<GroupEnrollment> {
      const enrollment = await loadEnrollment(enrollmentId);

      const isOwnApplication = enrollment.studentId === actor.userId;
      if (!isOwnApplication) {
        assertOwner(enrollment.group.teacherId, actor);
      }

      if (enrollment.status === 'LEFT') {
        return toEnrollment(enrollment);
      }

      const updated = await prisma.groupEnrollment.update({
        where: { id: enrollment.id },
        data: { status: 'LEFT', leftAt: now() },
        include: enrollmentInclude,
      });

      return toEnrollment(updated);
    },

    async getAttendance(actor: Actor, lessonId: string): Promise<LessonAttendance> {
      const { lesson, group } = await loadGroupLesson(actor, lessonId);
      return readRegister(lesson.id, group, lesson.startsAt);
    },

    async setAttendance(
      actor: Actor,
      lessonId: string,
      input: AttendanceUpdate,
    ): Promise<LessonAttendance> {
      const { lesson, group } = await loadGroupLesson(actor, lessonId);

      const members = await prisma.groupEnrollment.findMany({
        where: { groupId: group.id, status: 'ACTIVE' },
        select: { studentId: true },
      });
      const memberIds = new Set(members.map((member) => member.studentId));

      for (const entry of input.entries) {
        if (!memberIds.has(entry.studentId)) {
          throw new DomainError('VALIDATION_FAILED', 'У журналі є хтось не з цієї групи');
        }
      }

      // The register is replaced rather than merged, so unticking a name
      // actually removes the mark instead of leaving yesterday's answer.
      await prisma.$transaction([
        prisma.lessonAttendance.deleteMany({ where: { lessonId } }),
        prisma.lessonAttendance.createMany({
          data: input.entries.map((entry) => ({
            lessonId,
            studentId: entry.studentId,
            status: entry.status,
          })),
        }),
      ]);

      return readRegister(lesson.id, group, lesson.startsAt);
    },
  };
}

type GroupRow = Prisma.GroupGetPayload<{ include: typeof groupInclude }>;

function toGroup(row: GroupRow): Group {
  const seatsTaken = row._count.enrollments;

  return {
    id: row.id,
    name: row.name,
    teacher: {
      id: row.teacherId,
      firstName: row.teacher.user.firstName,
      lastName: row.teacher.user.lastName,
    },
    direction: {
      id: row.direction.id,
      slug: row.direction.slug,
      name: row.direction.name,
      description: row.direction.description,
      icon: row.direction.icon,
    },
    location: {
      id: row.location.id,
      name: row.location.name,
      address: row.location.address,
      mapUrl: row.location.mapUrl,
    },
    capacity: row.capacity,
    durationMinutes: row.durationMinutes,
    isOpenForEnrollment: row.isOpenForEnrollment,
    startsOn: formatLocalDate(fromDbDate(row.startsOn)),
    endsOn: row.endsOn ? formatLocalDate(fromDbDate(row.endsOn)) : null,
    // Sorted here rather than in the query: `include` with an `orderBy` would
    // have to be a mutable literal, and the timetable is at most seven rows.
    schedule: [...row.schedule]
      .sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute)
      .map((entry) => ({ weekday: entry.weekday, startTime: formatTimeOfDay(entry.startMinute) })),
    seatsTaken,
    seatsLeft: row.capacity - seatsTaken,
  };
}

type EnrollmentRow = Prisma.GroupEnrollmentGetPayload<{ include: typeof enrollmentInclude }>;

function toEnrollment(row: EnrollmentRow): GroupEnrollment {
  return {
    id: row.id,
    groupId: row.groupId,
    student: {
      id: row.studentId,
      firstName: row.student.firstName,
      lastName: row.student.lastName,
      phone: row.student.phone,
    },
    status: row.status,
    joinedAt: row.joinedAt.toISOString(),
    leftAt: row.leftAt ? row.leftAt.toISOString() : null,
  };
}

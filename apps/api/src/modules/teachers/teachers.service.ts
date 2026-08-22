import type {
  AdminTeacher,
  Direction,
  DirectionInput,
  DirectionPatch,
  Location,
  LocationInput,
  LocationPatch,
  PricePlan,
  PricePlanInput,
  PricePlanPatch,
  PublicTeacher,
  TeacherInvite,
  TeacherPatch,
} from '@palitra/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type {
  DirectionModel,
  LocationModel,
  PricePlanModel,
  UserModel,
} from '../../generated/prisma/models';
import { DomainError } from '../../http/error-handler';
import {
  defined,
  deleteRow,
  updateRow,
  withDependents,
  withReferences,
  withUnique,
} from '../../lib/rows';

/**
 * Mailing an invitation belongs to the auth module, which owns tokens and
 * letters. Creating the person belongs here. This is the seam between the two,
 * narrow on purpose: the teachers module can send an invitation and can do
 * nothing else to an account.
 */
export interface InvitePort {
  sendInvite(user: UserModel): Promise<void>;
}

export interface TeachersServiceDeps {
  prisma: PrismaClient;
  invite: InvitePort;
}

export interface TeachersService {
  listTeachers(): Promise<PublicTeacher[]>;
  getTeacher(teacherId: string): Promise<PublicTeacher>;
  listLocations(): Promise<Location[]>;
  listDirections(): Promise<Direction[]>;
  getDirection(slug: string): Promise<Direction>;
  listPricePlans(): Promise<PricePlan[]>;

  /**
   * The admin's half. Every list here includes the drafts and the people who
   * have left, and every teacher comes back with their address and phone -
   * this is the studio looking at its own staff, not the site looking at a
   * card.
   */
  listAllTeachers(): Promise<AdminTeacher[]>;
  getTeacherForAdmin(teacherId: string): Promise<AdminTeacher>;
  inviteTeacher(input: TeacherInvite): Promise<AdminTeacher>;
  updateTeacher(teacherId: string, patch: TeacherPatch): Promise<AdminTeacher>;
  setTeacherDirections(teacherId: string, ids: readonly string[]): Promise<AdminTeacher>;
  setTeacherLocations(teacherId: string, ids: readonly string[]): Promise<AdminTeacher>;
  reinviteTeacher(teacherId: string): Promise<void>;

  /**
   * The reference tables, edited as rows rather than as the folded shapes the
   * site reads: the screen is editing the row, so the row is what it gets back
   * - with the ordering and the retired price plans the public lists leave out.
   */
  listAllLocations(): Promise<LocationModel[]>;
  createLocation(input: LocationInput): Promise<LocationModel>;
  updateLocation(id: string, patch: LocationPatch): Promise<LocationModel>;
  deleteLocation(id: string): Promise<void>;

  listAllDirections(): Promise<DirectionModel[]>;
  createDirection(input: DirectionInput): Promise<DirectionModel>;
  updateDirection(id: string, patch: DirectionPatch): Promise<DirectionModel>;
  deleteDirection(id: string): Promise<void>;

  listAllPricePlans(): Promise<PricePlanModel[]>;
  createPricePlan(input: PricePlanInput): Promise<PricePlanModel>;
  updatePricePlan(id: string, patch: PricePlanPatch): Promise<PricePlanModel>;
  deletePricePlan(id: string): Promise<void>;
}

/**
 * Everything here is readable by anyone. The teacher's own account fields -
 * email, phone - are deliberately absent: a public teacher list must not
 * double as a contact database.
 */
const teacherInclude = {
  user: true,
  directions: { include: { direction: true }, orderBy: { direction: { sortOrder: 'asc' } } },
  locations: { include: { location: true }, orderBy: { location: { sortOrder: 'asc' } } },
} as const;

export function createTeachersService({ prisma, invite }: TeachersServiceDeps): TeachersService {
  /**
   * Loads a teacher the admin named, drafts and departed staff included. Every
   * write below starts here, so a request for someone who does not exist ends
   * as a 404 before anything has been written.
   */
  async function loadForAdmin(teacherId: string): Promise<AdminTeacherRow> {
    const profile = await prisma.teacherProfile.findUnique({
      where: { userId: teacherId },
      include: teacherInclude,
    });

    if (!profile) {
      throw new DomainError('NOT_FOUND', 'Викладача не знайдено');
    }

    return profile;
  }

  /**
   * A whole set of links at once, in one transaction. Replacing rather than
   * adding is what the screen means by "these are the subjects", and the
   * transaction is what makes a bad id leave the previous set standing instead
   * of wiping it and then failing to write the new one.
   */
  async function setLinks(
    teacherId: string,
    ids: readonly string[],
    write: (teacherId: string, ids: string[]) => Prisma.PrismaPromise<unknown>[],
    message: string,
  ): Promise<AdminTeacher> {
    await loadForAdmin(teacherId);

    await withReferences(() => prisma.$transaction(write(teacherId, [...new Set(ids)])), message);

    return toAdminTeacher(await loadForAdmin(teacherId));
  }

  return {
    async listTeachers(): Promise<PublicTeacher[]> {
      const profiles = await prisma.teacherProfile.findMany({
        where: { isPublished: true },
        include: teacherInclude,
        orderBy: [{ sortOrder: 'asc' }, { user: { lastName: 'asc' } }],
      });

      return profiles.map(toPublicTeacher);
    },

    async getTeacher(teacherId: string): Promise<PublicTeacher> {
      const profile = await prisma.teacherProfile.findUnique({
        where: { userId: teacherId },
        include: teacherInclude,
      });

      // An unpublished profile answers exactly like a missing one: whether a
      // draft exists is not the visitor's business.
      if (!profile || !profile.isPublished) {
        throw new DomainError('NOT_FOUND', 'Викладача не знайдено');
      }

      return toPublicTeacher(profile);
    },

    async listLocations(): Promise<Location[]> {
      const locations = await prisma.location.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      return locations.map(toLocation);
    },

    async listDirections(): Promise<Direction[]> {
      const directions = await prisma.direction.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      return directions.map(toDirection);
    },

    /** By slug, because that is what the direction's own page is addressed by. */
    async getDirection(slug: string): Promise<Direction> {
      const direction = await prisma.direction.findUnique({ where: { slug } });

      if (!direction) {
        throw new DomainError('NOT_FOUND', 'Напрям не знайдено');
      }

      return toDirection(direction);
    },

    /**
     * Only the active plans leave the API. An inactive one is last season's
     * price - keeping it visible would let a booking be made against a tariff
     * the studio no longer sells.
     */
    async listPricePlans(): Promise<PricePlan[]> {
      const plans = await prisma.pricePlan.findMany({
        where: { isActive: true },
        include: { direction: true },
        orderBy: [{ direction: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { priceUah: 'asc' }],
      });

      return plans.map((plan) => ({
        id: plan.id,
        directionId: plan.directionId,
        directionName: plan.direction.name,
        name: plan.name,
        lessonsCount: plan.lessonsCount,
        durationMinutes: plan.durationMinutes,
        format: plan.format,
        priceUah: plan.priceUah,
      }));
    },

    // -----------------------------------------------------------------------
    // The admin's half. Same tables as the reads above; what differs is that
    // nothing is filtered out - see `teachers.admin.router.ts` for where the
    // guard that keeps this half out of public reach is mounted.
    // -----------------------------------------------------------------------

    async listAllTeachers(): Promise<AdminTeacher[]> {
      const profiles = await prisma.teacherProfile.findMany({
        include: teacherInclude,
        orderBy: [{ sortOrder: 'asc' }, { user: { lastName: 'asc' } }],
      });

      return profiles.map(toAdminTeacher);
    },

    async getTeacherForAdmin(teacherId): Promise<AdminTeacher> {
      return toAdminTeacher(await loadForAdmin(teacherId));
    },

    /**
     * The account and its profile are made together, and neither carries a
     * password: what the teacher receives is a link, and they choose their own
     * on the other side of it.
     */
    async inviteTeacher(input): Promise<AdminTeacher> {
      const profile = await withUnique(
        () =>
          prisma.teacherProfile.create({
            data: {
              user: {
                create: {
                  email: input.email,
                  firstName: input.firstName,
                  lastName: input.lastName,
                  phone: input.phone,
                  role: 'TEACHER',
                },
              },
            },
            include: teacherInclude,
          }),
        'EMAIL_TAKEN',
        'Ця адреса вже зареєстрована',
      );

      // The letter goes out after the account exists, because the link is a
      // token belonging to it. If the mail fails the teacher is still on the
      // list, marked as not having accepted, and the re-invite button is the
      // way out - which is better than an account that was rolled back after
      // the studio had already been told it was created.
      await invite.sendInvite(profile.user);

      return toAdminTeacher(profile);
    },

    async updateTeacher(teacherId, patch): Promise<AdminTeacher> {
      await loadForAdmin(teacherId);

      // The name and the phone belong to the account, the bio and the switches
      // to the profile. The screen edits one card and should not have to know
      // where each field is stored.
      const { firstName, lastName, phone, ...profileFields } = patch;
      const person = defined({ firstName, lastName, phone });

      const updated = await prisma.teacherProfile.update({
        where: { userId: teacherId },
        data: {
          ...defined(profileFields),
          ...(Object.keys(person).length > 0 ? { user: { update: person } } : {}),
        },
        include: teacherInclude,
      });

      return toAdminTeacher(updated);
    },

    async setTeacherDirections(teacherId, ids): Promise<AdminTeacher> {
      return setLinks(
        teacherId,
        ids,
        (owner, directionIds) => [
          prisma.teacherDirection.deleteMany({ where: { teacherId: owner } }),
          prisma.teacherDirection.createMany({
            data: directionIds.map((directionId) => ({ teacherId: owner, directionId })),
          }),
        ],
        'Такого напряму не існує',
      );
    },

    async setTeacherLocations(teacherId, ids): Promise<AdminTeacher> {
      return setLinks(
        teacherId,
        ids,
        (owner, locationIds) => [
          prisma.teacherLocation.deleteMany({ where: { teacherId: owner } }),
          prisma.teacherLocation.createMany({
            data: locationIds.map((locationId) => ({ teacherId: owner, locationId })),
          }),
        ],
        'Такої адреси не існує',
      );
    },

    async reinviteTeacher(teacherId): Promise<void> {
      const profile = await loadForAdmin(teacherId);

      // An "invitation" to someone who has been teaching for a year would be a
      // password reset started by somebody else. Resetting a password is the
      // account holder's own action, from their own login screen.
      if (profile.user.passwordHash !== null) {
        throw new DomainError(
          'VALIDATION_FAILED',
          'Викладач уже має пароль — відновлення він запускає сам',
        );
      }

      await invite.sendInvite(profile.user);
    },

    // -----------------------------------------------------------------------
    // The reference tables. Rarely edited and everything else is built on
    // them, which is why nothing here deletes quietly: a row the studio wants
    // gone is refused while lessons, groups or subscriptions still name it.
    // -----------------------------------------------------------------------

    async listAllLocations(): Promise<LocationModel[]> {
      return prisma.location.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    },

    async createLocation(input): Promise<LocationModel> {
      return prisma.location.create({ data: input });
    },

    async updateLocation(id, patch): Promise<LocationModel> {
      return updateRow(
        () => prisma.location.update({ where: { id }, data: defined(patch) }),
        'Локацію не знайдено',
      );
    },

    async deleteLocation(id): Promise<void> {
      await withDependents(
        () => deleteRow(() => prisma.location.delete({ where: { id } }), 'Локацію не знайдено'),
        'Локацію не можна видалити: на ній є заняття, групи або графік роботи',
      );
    },

    async listAllDirections(): Promise<DirectionModel[]> {
      return prisma.direction.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    },

    async createDirection(input): Promise<DirectionModel> {
      return withUnique(
        () => prisma.direction.create({ data: input }),
        'SLUG_TAKEN',
        'Напрям із таким посиланням уже існує',
      );
    },

    async updateDirection(id, patch): Promise<DirectionModel> {
      return withUnique(
        () =>
          updateRow(
            () => prisma.direction.update({ where: { id }, data: defined(patch) }),
            'Напрям не знайдено',
          ),
        'SLUG_TAKEN',
        'Напрям із таким посиланням уже існує',
      );
    },

    async deleteDirection(id): Promise<void> {
      // The schema would take the direction's price plans down with it. That
      // is not something to do behind the studio's back, so a direction that
      // still has prices is refused and the prices are dealt with first.
      const prices = await prisma.pricePlan.count({ where: { directionId: id } });
      if (prices > 0) {
        throw new DomainError(
          'IN_USE',
          'Спершу приберіть тарифи цього напряму — інакше вони зникнуть разом із ним',
        );
      }

      await withDependents(
        () => deleteRow(() => prisma.direction.delete({ where: { id } }), 'Напрям не знайдено'),
        'Напрям не можна видалити: на ньому є групи або заняття',
      );
    },

    async listAllPricePlans(): Promise<PricePlanModel[]> {
      return prisma.pricePlan.findMany({
        orderBy: [{ direction: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { priceUah: 'asc' }],
      });
    },

    async createPricePlan(input): Promise<PricePlanModel> {
      return withReferences(
        () => prisma.pricePlan.create({ data: input }),
        'Такого напряму не існує',
      );
    },

    async updatePricePlan(id, patch): Promise<PricePlanModel> {
      return withReferences(
        () =>
          updateRow(
            () => prisma.pricePlan.update({ where: { id }, data: defined(patch) }),
            'Тариф не знайдено',
          ),
        'Такого напряму не існує',
      );
    },

    async deletePricePlan(id): Promise<void> {
      await withDependents(
        () => deleteRow(() => prisma.pricePlan.delete({ where: { id } }), 'Тариф не знайдено'),
        'Тариф не можна видалити: за ним продані абонементи. Зробіть його неактивним',
      );
    },
  };
}

interface TeacherRow {
  userId: string;
  bio: string | null;
  experienceYears: number | null;
  photoUrl: string | null;
  user: { firstName: string; lastName: string };
  directions: { direction: DirectionRow }[];
  locations: { location: LocationRow }[];
}

interface DirectionRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
}

interface LocationRow {
  id: string;
  name: string;
  address: string;
  mapUrl: string | null;
}

export function toPublicTeacher(profile: TeacherRow): PublicTeacher {
  return {
    id: profile.userId,
    firstName: profile.user.firstName,
    lastName: profile.user.lastName,
    bio: profile.bio,
    experienceYears: profile.experienceYears,
    photoUrl: profile.photoUrl,
    directions: profile.directions.map((link) => toDirection(link.direction)),
    locations: profile.locations.map((link) => toLocation(link.location)),
  };
}

/**
 * The same row read by someone who is allowed to see all of it: the two
 * switches, the place in the list, and the whole account behind the card -
 * whole because that is what an invitation is addressed to.
 */
interface AdminTeacherRow extends TeacherRow {
  isPublished: boolean;
  isActive: boolean;
  sortOrder: number;
  user: UserModel;
}

export function toAdminTeacher(profile: AdminTeacherRow): AdminTeacher {
  return {
    ...toPublicTeacher(profile),
    email: profile.user.email,
    phone: profile.user.phone,
    isPublished: profile.isPublished,
    isActive: profile.isActive,
    sortOrder: profile.sortOrder,
    // The hash never leaves the API; whether there is one is what the screen
    // needs to tell an invitation still in the post from a teacher at work.
    hasPassword: profile.user.passwordHash !== null,
  };
}

export function toDirection(direction: DirectionRow): Direction {
  return {
    id: direction.id,
    slug: direction.slug,
    name: direction.name,
    description: direction.description,
    icon: direction.icon,
  };
}

export function toLocation(location: LocationRow): Location {
  return {
    id: location.id,
    name: location.name,
    address: location.address,
    mapUrl: location.mapUrl,
  };
}

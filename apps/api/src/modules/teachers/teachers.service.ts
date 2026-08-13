import type { Direction, Location, PublicTeacher } from '@palitra/shared';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { DomainError } from '../../http/error-handler';

export interface TeachersServiceDeps {
  prisma: PrismaClient;
}

export interface TeachersService {
  listTeachers(): Promise<PublicTeacher[]>;
  getTeacher(teacherId: string): Promise<PublicTeacher>;
  listLocations(): Promise<Location[]>;
  listDirections(): Promise<Direction[]>;
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

export function createTeachersService({ prisma }: TeachersServiceDeps): TeachersService {
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

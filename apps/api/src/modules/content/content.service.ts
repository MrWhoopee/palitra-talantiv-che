import {
  playbillDayStart,
  type Achievement,
  type AchievementInput,
  type AchievementPatch,
  type GalleryItem,
  type GalleryItemInput,
  type GalleryItemPatch,
  type StudioEvent,
  type StudioEventInput,
  type StudioEventPatch,
  type Testimonial,
  type TestimonialInput,
  type TestimonialPatch,
} from '@palitra/shared';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import type {
  AchievementModel,
  GalleryItemModel,
  StudioEventModel,
  TestimonialModel,
} from '../../generated/prisma/models';
import { DomainError } from '../../http/error-handler';
import { toLocation } from '../teachers/teachers.service';

export interface ContentServiceDeps {
  prisma: PrismaClient;
}

export interface ContentService {
  listEvents(when: 'upcoming' | 'past' | 'all'): Promise<StudioEvent[]>;
  getEvent(slug: string): Promise<StudioEvent>;
  listGallery(): Promise<GalleryItem[]>;
  listTestimonials(): Promise<Testimonial[]>;
  listAchievements(): Promise<Achievement[]>;

  /**
   * The admin's half. Every list here includes drafts, because a draft is
   * exactly what the studio came to work on, and every one of them returns the
   * stored row rather than the folded public shape: the screen is editing the
   * row, so the row is what it needs back.
   */
  listAllEvents(): Promise<StudioEventModel[]>;
  createEvent(input: StudioEventInput): Promise<StudioEventModel>;
  updateEvent(id: string, patch: StudioEventPatch): Promise<StudioEventModel>;
  deleteEvent(id: string): Promise<void>;

  listAllGallery(): Promise<GalleryItemModel[]>;
  createGalleryItem(input: GalleryItemInput): Promise<GalleryItemModel>;
  updateGalleryItem(id: string, patch: GalleryItemPatch): Promise<GalleryItemModel>;
  /** Returns the addresses nothing refers to any more, for the caller to delete. */
  deleteGalleryItem(id: string): Promise<string[]>;
  reorderGallery(ids: readonly string[]): Promise<void>;

  listAllTestimonials(): Promise<TestimonialModel[]>;
  createTestimonial(input: TestimonialInput): Promise<TestimonialModel>;
  updateTestimonial(id: string, patch: TestimonialPatch): Promise<TestimonialModel>;
  deleteTestimonial(id: string): Promise<void>;

  listAllAchievements(): Promise<AchievementModel[]>;
  createAchievement(input: AchievementInput): Promise<AchievementModel>;
  updateAchievement(id: string, patch: AchievementPatch): Promise<AchievementModel>;
  deleteAchievement(id: string): Promise<void>;
}

const eventInclude = { location: true } as const;

/**
 * The public site's content, read-only. Nothing here checks a token, and
 * nothing here returns an unpublished row: `isPublished` is the studio's
 * switch between a draft and something the world can see, so it is applied in
 * the service rather than left to each caller to remember.
 */
export function createContentService({ prisma }: ContentServiceDeps): ContentService {
  return {
    /**
     * Split on the clock rather than on a flag, because "upcoming" is a fact
     * about now and not something anyone maintains by hand. An event with an
     * end time counts as upcoming until it ends - a concert running right now
     * belongs in the playbill, not in the archive.
     *
     * An event with no end time has none to compare against, so its day stands
     * in for it: it stays in the playbill until midnight in Kyiv. Comparing its
     * start against `now` instead would drop a concert out of the playbill one
     * minute after it began, while the audience was still arriving.
     */
    async listEvents(when): Promise<StudioEvent[]> {
      const now = new Date();
      const dayStart = playbillDayStart(now);
      const rows = await prisma.studioEvent.findMany({
        where: {
          isPublished: true,
          ...(when === 'upcoming'
            ? { OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: dayStart } }] }
            : {}),
          ...(when === 'past'
            ? { OR: [{ endsAt: { lt: now } }, { endsAt: null, startsAt: { lt: dayStart } }] }
            : {}),
        },
        include: eventInclude,
        orderBy: { startsAt: when === 'past' ? 'desc' : 'asc' },
      });

      return rows.map(toStudioEvent);
    },

    async getEvent(slug): Promise<StudioEvent> {
      const row = await prisma.studioEvent.findUnique({ where: { slug }, include: eventInclude });

      // A draft answers exactly like a missing event, as an unpublished
      // teacher profile does: whether one exists is not the visitor's business.
      if (!row || !row.isPublished) {
        throw new DomainError('NOT_FOUND', 'Подію не знайдено');
      }

      return toStudioEvent(row);
    },

    async listGallery(): Promise<GalleryItem[]> {
      const rows = await prisma.galleryItem.findMany({
        where: { isPublished: true },
        include: { event: { select: { slug: true } } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      });

      return rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        url: row.url,
        thumbUrl: row.thumbUrl,
        caption: row.caption,
        eventSlug: row.event?.slug ?? null,
      }));
    },

    async listTestimonials(): Promise<Testimonial[]> {
      const rows = await prisma.testimonial.findMany({
        where: { isPublished: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      });

      return rows.map((row) => ({ id: row.id, authorName: row.authorName, text: row.text }));
    },

    async listAchievements(): Promise<Achievement[]> {
      const rows = await prisma.achievement.findMany({
        where: { isPublished: true },
        orderBy: [{ year: 'desc' }, { sortOrder: 'asc' }],
      });

      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        year: row.year,
        imageUrl: row.imageUrl,
      }));
    },

    // -----------------------------------------------------------------------
    // Writes. Same tables, same file - the reads above are the other half of
    // these rows, and separating them would put one table's rules in two
    // places. What is separated is the routing: see `content.admin.router.ts`.
    // -----------------------------------------------------------------------

    async listAllEvents(): Promise<StudioEventModel[]> {
      return prisma.studioEvent.findMany({ orderBy: { startsAt: 'desc' } });
    },

    async createEvent(input): Promise<StudioEventModel> {
      return withUniqueSlug(() =>
        prisma.studioEvent.create({
          data: {
            slug: input.slug,
            title: input.title,
            description: input.description,
            startsAt: new Date(input.startsAt),
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            locationId: input.locationId,
            coverUrl: input.coverUrl,
            kind: input.kind,
            isPublished: input.isPublished,
          },
        }),
      );
    },

    async updateEvent(id, patch): Promise<StudioEventModel> {
      const current = await prisma.studioEvent.findUnique({ where: { id } });
      if (!current) {
        throw new DomainError('NOT_FOUND', 'Подію не знайдено');
      }

      // Re-checked here rather than in the schema: a patch may carry only one
      // of the two ends, and the rule is about the pair. A concert that ends
      // before it starts renders as a negative progress bar on the site.
      const startsAt = patch.startsAt ? new Date(patch.startsAt) : current.startsAt;
      const endsAt =
        patch.endsAt === undefined ? current.endsAt : patch.endsAt && new Date(patch.endsAt);
      if (endsAt && endsAt <= startsAt) {
        throw new DomainError('VALIDATION_FAILED', 'Подія не може завершитись раніше, ніж почалась');
      }

      return withUniqueSlug(() =>
        prisma.studioEvent.update({ where: { id }, data: toEventData(patch) }),
      );
    },

    async deleteEvent(id): Promise<void> {
      // The gallery keeps its pictures: the schema nulls `eventId` rather than
      // cascading, because a concert removed from the playbill does not take
      // the photographs of it with it.
      await deleteRow(() => prisma.studioEvent.delete({ where: { id } }), 'Подію не знайдено');
    },

    async listAllGallery(): Promise<GalleryItemModel[]> {
      return prisma.galleryItem.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
    },

    async createGalleryItem(input): Promise<GalleryItemModel> {
      return prisma.galleryItem.create({ data: input });
    },

    async updateGalleryItem(id, patch): Promise<GalleryItemModel> {
      return updateRow(
        () => prisma.galleryItem.update({ where: { id }, data: defined(patch) }),
        'Фото не знайдено',
      );
    },

    async deleteGalleryItem(id): Promise<string[]> {
      const row = await prisma.galleryItem.findUnique({ where: { id } });
      if (!row) {
        throw new DomainError('NOT_FOUND', 'Фото не знайдено');
      }

      await prisma.galleryItem.delete({ where: { id } });

      // The row is gone before the files are; the reverse order would leave a
      // row pointing at a picture that no longer exists if the delete failed.
      return [row.url, ...(row.thumbUrl ? [row.thumbUrl] : [])];
    },

    async reorderGallery(ids): Promise<void> {
      // One statement per row, in one transaction: the order is a property of
      // the whole list, and a half-applied ordering is a list nobody arranged.
      await prisma.$transaction(
        ids.map((id, index) =>
          prisma.galleryItem.update({ where: { id }, data: { sortOrder: index } }),
        ),
      );
    },

    async listAllTestimonials(): Promise<TestimonialModel[]> {
      return prisma.testimonial.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      });
    },

    async createTestimonial(input): Promise<TestimonialModel> {
      return prisma.testimonial.create({ data: input });
    },

    async updateTestimonial(id, patch): Promise<TestimonialModel> {
      return updateRow(
        () => prisma.testimonial.update({ where: { id }, data: defined(patch) }),
        'Відгук не знайдено',
      );
    },

    async deleteTestimonial(id): Promise<void> {
      await deleteRow(() => prisma.testimonial.delete({ where: { id } }), 'Відгук не знайдено');
    },

    async listAllAchievements(): Promise<AchievementModel[]> {
      return prisma.achievement.findMany({ orderBy: [{ year: 'desc' }, { sortOrder: 'asc' }] });
    },

    async createAchievement(input): Promise<AchievementModel> {
      return prisma.achievement.create({ data: input });
    },

    async updateAchievement(id, patch): Promise<AchievementModel> {
      return updateRow(
        () => prisma.achievement.update({ where: { id }, data: defined(patch) }),
        'Досягнення не знайдено',
      );
    },

    async deleteAchievement(id): Promise<void> {
      await deleteRow(() => prisma.achievement.delete({ where: { id } }), 'Досягнення не знайдено');
    },
  };
}

const UNIQUE_VIOLATION = 'P2002';
const RECORD_NOT_FOUND = 'P2025';

function isPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/**
 * The slug is the address of the page, so the database decides who gets it.
 * Checking first and inserting after would let two events created in the same
 * second both pass the check.
 */
async function withUniqueSlug<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isPrismaCode(error, UNIQUE_VIOLATION)) {
      throw new DomainError('SLUG_TAKEN', 'Подія з таким посиланням уже існує');
    }
    throw error;
  }
}

async function updateRow<T>(write: () => Promise<T>, message: string): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isPrismaCode(error, RECORD_NOT_FOUND)) {
      throw new DomainError('NOT_FOUND', message);
    }
    throw error;
  }
}

async function deleteRow(write: () => Promise<unknown>, message: string): Promise<void> {
  await updateRow(write, message);
}

/**
 * A patch without the keys that were never sent.
 *
 * `{ title: undefined }` and "no title in the body" mean the same thing here -
 * leave it alone - but they are not the same value to Prisma, which reads an
 * explicit `undefined` as a field it must not have been given at all. Dropping
 * the keys says it once, instead of at every call site.
 */
function defined<T extends object>(patch: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as never;
}

/** Dates arrive as ISO strings on the wire and go into the database as instants. */
function toEventData<T extends StudioEventPatch>(input: T) {
  return {
    ...defined(input),
    ...(input.startsAt === undefined ? {} : { startsAt: new Date(input.startsAt) }),
    ...(input.endsAt === undefined ? {} : { endsAt: input.endsAt ? new Date(input.endsAt) : null }),
  };
}

interface StudioEventRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  coverUrl: string | null;
  kind: StudioEvent['kind'];
  location: { id: string; name: string; address: string; mapUrl: string | null } | null;
}

function toStudioEvent(row: StudioEventRow): StudioEvent {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    location: row.location ? toLocation(row.location) : null,
    coverUrl: row.coverUrl,
    kind: row.kind,
  };
}

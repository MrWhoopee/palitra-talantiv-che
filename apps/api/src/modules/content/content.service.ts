import {
  playbillDayStart,
  type Achievement,
  type GalleryItem,
  type StudioEvent,
  type Testimonial,
} from '@palitra/shared';
import type { PrismaClient } from '../../generated/prisma/client.js';
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

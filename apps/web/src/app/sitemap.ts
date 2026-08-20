import type { Direction, PublicTeacher, StudioEvent } from '@palitra/shared';
import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';
import { absoluteUrl } from '@/lib/seo';

/**
 * The public site, and only the public site: the cabinet and the auth screens
 * are behind a login and have nothing to offer a crawler.
 *
 * Drafts never appear here, because the endpoints this reads never return one.
 * That is the whole reason the filter lives in the service rather than in each
 * page - a sitemap built against an unfiltered list would publish the studio's
 * unfinished announcements.
 */
export const dynamic = 'force-dynamic';

const STATIC_PATHS = [
  '/',
  '/about',
  '/teachers',
  '/directions',
  '/groups',
  '/events',
  '/gallery',
  '/achievements',
  '/contacts',
  '/rules',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [directions, events, teachers] = await Promise.all([
    api.getDirections().catch(() => [] as Direction[]),
    api.getEvents('all').catch(() => [] as StudioEvent[]),
    api.getTeachers().catch(() => [] as PublicTeacher[]),
  ]);

  const now = new Date();

  return [
    ...STATIC_PATHS.map((path) => ({
      url: absoluteUrl(path),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: path === '/' ? 1 : 0.7,
    })),
    ...directions.map((direction) => ({
      url: absoluteUrl(`/directions/${direction.slug}`),
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...teachers.map((teacher) => ({
      url: absoluteUrl(`/teachers/${teacher.id}`),
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...events.map((event) => ({
      url: absoluteUrl(`/events/${event.slug}`),
      // The date the event happens is the closest thing to a modification date
      // we hold, and it is the one a crawler can act on.
      lastModified: new Date(event.startsAt),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}

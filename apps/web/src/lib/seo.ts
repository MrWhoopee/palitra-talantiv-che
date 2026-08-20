import type { StudioEvent } from '@palitra/shared';
import type { Metadata } from 'next';
import { STUDIO } from '@/lib/studio';

/**
 * Where the site lives. Canonical links, the sitemap and the structured data
 * all need an absolute address, and a page rendered on the server has no way
 * to guess one - so it is configured, with the development address as the
 * default because that is where it is true most often.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

export function absoluteUrl(path: string): string {
  return new URL(path, `${SITE_URL}/`).toString();
}

/**
 * The Open Graph block for one page.
 *
 * The default card is spelled out rather than left to be inherited: a page
 * that declares an `openGraph` of its own replaces the layout's whole block,
 * image included, and the result is a link that shares with a title and no
 * picture. Passing a page's own cover replaces the mark for that page only.
 */
export function openGraphFor(page: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
}): NonNullable<Metadata['openGraph']> {
  return {
    type: 'website',
    siteName: STUDIO.name,
    locale: 'uk_UA',
    title: page.title,
    description: page.description,
    url: page.path,
    images: [page.image ?? '/opengraph-image'],
  };
}

/**
 * The studio itself, in the vocabulary search engines read. `MusicSchool` is
 * the narrowest schema.org type that fits, and the narrower type is what puts
 * the studio on a map rather than in a list of businesses.
 *
 * Only what we actually know is stated. A telephone the studio has not given
 * us would be a made-up fact in machine-readable form, which is worse than a
 * missing one.
 */
export function musicSchoolJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicSchool',
    name: STUDIO.name,
    url: SITE_URL,
    logo: absoluteUrl('/logo-avatar.svg'),
    foundingDate: String(STUDIO.since),
    areaServed: STUDIO.city,
    address: STUDIO.locations.map((location) => ({
      '@type': 'PostalAddress',
      streetAddress: location.address,
      addressLocality: STUDIO.city,
      addressCountry: 'UA',
    })),
    ...(STUDIO.phone === null ? {} : { telephone: STUDIO.phone }),
    ...(STUDIO.instagram === null ? {} : { sameAs: [STUDIO.instagram] }),
  };
}

/** One event, so it can appear as an event rather than as a page about one. */
export function eventJsonLd(event: StudioEvent): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    url: absoluteUrl(`/events/${event.slug}`),
    startDate: event.startsAt,
    ...(event.endsAt === null ? {} : { endDate: event.endsAt }),
    ...(event.description === null ? {} : { description: event.description }),
    ...(event.coverUrl === null ? {} : { image: absoluteUrl(event.coverUrl) }),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    organizer: { '@type': 'MusicSchool', name: STUDIO.name, url: SITE_URL },
    ...(event.location === null
      ? {}
      : {
          location: {
            '@type': 'Place',
            name: event.location.name,
            address: {
              '@type': 'PostalAddress',
              streetAddress: event.location.address,
              addressLocality: STUDIO.city,
              addressCountry: 'UA',
            },
          },
        }),
  };
}

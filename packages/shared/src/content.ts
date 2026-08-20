import { z } from 'zod';
import { locationSchema } from './teachers';
import { fromZonedTime, toLocalDate } from './time';

/**
 * The public site's own content: the playbill, the gallery, what people said,
 * what the studio won. Read-only from the outside until the admin arrives in
 * stage 6 - nothing here has a write contract yet.
 */

export const studioEventKindSchema = z.enum(['CONCERT', 'OPEN_LESSON', 'COMPETITION', 'OTHER']);

export type StudioEventKind = z.infer<typeof studioEventKindSchema>;

export const studioEventSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  /** Instants, so the client formats them in the studio's zone rather than its own. */
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  location: locationSchema.nullable(),
  coverUrl: z.string().nullable(),
  kind: studioEventKindSchema,
});

export type StudioEvent = z.infer<typeof studioEventSchema>;

export const studioEventListSchema = z.array(studioEventSchema);

export const galleryItemKindSchema = z.enum(['PHOTO', 'VIDEO']);

export type GalleryItemKind = z.infer<typeof galleryItemKindSchema>;

export const galleryItemSchema = z.object({
  id: z.uuid(),
  kind: galleryItemKindSchema,
  url: z.string(),
  thumbUrl: z.string().nullable(),
  caption: z.string().nullable(),
  eventSlug: z.string().nullable(),
});

export type GalleryItem = z.infer<typeof galleryItemSchema>;

export const testimonialSchema = z.object({
  id: z.uuid(),
  authorName: z.string(),
  text: z.string(),
});

export type Testimonial = z.infer<typeof testimonialSchema>;

export const achievementSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  year: z.number().int(),
  imageUrl: z.string().nullable(),
});

export type Achievement = z.infer<typeof achievementSchema>;

/**
 * The longest lesson on the price list. Every duration bar on the site is read
 * against it, so a 30-minute lesson fills half the track and an hour fills all
 * of it - the bar means "how much of an hour", not "how much of the widest bar
 * on this screen", which would change meaning as the list changed.
 */
export const LONGEST_LESSON_MINUTES = 60;

/** A lesson's length as a share of the longest one, for the track's fill. */
export function lessonSharePercent(minutes: number): number {
  return clampPercent((minutes / LONGEST_LESSON_MINUTES) * 100);
}

/**
 * How far an event has got, from nothing at its start to full at its end. An
 * event with no end time is either ahead of us or behind us and has no middle,
 * so it reads as empty until it starts and full afterwards.
 */
export function eventSharePercent(
  startsAt: Date,
  endsAt: Date | null,
  now: Date = new Date(),
): number {
  if (endsAt === null || endsAt.getTime() <= startsAt.getTime()) {
    return now.getTime() < startsAt.getTime() ? 0 : 100;
  }

  const elapsed = now.getTime() - startsAt.getTime();
  return clampPercent((elapsed / (endsAt.getTime() - startsAt.getTime())) * 100);
}

/**
 * The moment the playbill starts: midnight in Kyiv on the day `now` falls in.
 *
 * An event with no end time is not over the minute it begins - a concert
 * announced for 18:00 belongs in the playbill for the whole of its day, not
 * until 18:01. Comparing against the day's start rather than against `now` is
 * what keeps it there, and it has to be Kyiv's midnight: on a server set to
 * UTC the studio's evening events would move into the archive two or three
 * hours before the day ended in Cherkasy.
 */
export function playbillDayStart(now: Date = new Date()): Date {
  return fromZonedTime(toLocalDate(now), 0);
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * A YouTube link in the form that can be put in an `<iframe src>`, or `null`
 * for anything else.
 *
 * The studio pastes links from wherever it finds them - `youtu.be`, a `watch`
 * page, sometimes an embed URL already - and all three have to end up as the
 * same address. Anything that is not recognisably a video id is refused rather
 * than passed through: the value ends up in a `src` attribute, and a `src`
 * built out of unchecked text is how a page starts loading someone else's
 * script.
 */
export function youtubeEmbedUrl(url: string): string | null {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '');
  const id =
    host === 'youtu.be'
      ? parsed.pathname.slice(1)
      : host === 'youtube.com' || host === 'm.youtube.com'
        ? (parsed.searchParams.get('v') ?? stripPrefix(parsed.pathname, '/embed/'))
        : null;

  return id !== null && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube.com/embed/${id}` : null;
}

function stripPrefix(value: string, prefix: string): string | null {
  return value.startsWith(prefix) ? value.slice(prefix.length) : null;
}

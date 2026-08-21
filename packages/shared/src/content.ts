import { z } from 'zod';
import { optionalText, slugSchema } from './fields';
import { locationSchema } from './teachers';
import { fromZonedTime, toLocalDate } from './time';

/**
 * The public site's own content: the playbill, the gallery, what people said,
 * what the studio won. The shapes the site reads come first; the shapes the
 * admin writes are at the bottom of the file.
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

// ---------------------------------------------------------------------------
// What the admin writes. The site reads the shapes above; these are the shapes
// that produce them, and they are shared so that the form in the browser and
// the endpoint behind it can never disagree about a rule.
// ---------------------------------------------------------------------------

/** The page address of an event, under the name the rest of the app knows. */
export { slugSchema };

const studioEventFields = z.object({
  slug: slugSchema,
  title: z.string().trim().min(2).max(160),
  description: optionalText(4000),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullish().default(null),
  locationId: z.uuid().nullish().default(null),
  coverUrl: optionalText(500),
  kind: studioEventKindSchema.default('CONCERT'),
  isPublished: z.boolean().default(false),
});

export const studioEventInputSchema = studioEventFields.refine(
  (value) => value.endsAt === null || value.endsAt > value.startsAt,
  { message: 'Подія не може завершитись раніше, ніж почалась', path: ['endsAt'] },
);

export type StudioEventInput = z.infer<typeof studioEventInputSchema>;

/**
 * Editing sends only what changed, so it is the bare fields that are made
 * partial and not the checked schema: a patch may carry one end of the event
 * and not the other, and a rule about the pair cannot be decided from half of
 * it. That rule is re-checked in the service, against the stored row.
 */
export const studioEventPatchSchema = studioEventFields.partial();

export type StudioEventPatch = z.infer<typeof studioEventPatchSchema>;

const galleryItemFields = z.object({
  kind: galleryItemKindSchema.default('PHOTO'),
  url: z.string().trim().min(1).max(500),
  thumbUrl: optionalText(500),
  caption: optionalText(300),
  eventId: z.uuid().nullish().default(null),
  // A photo is not a draft: it was uploaded to be shown. A testimonial is,
  // which is why the two defaults differ.
  isPublished: z.boolean().default(true),
});

export const galleryItemInputSchema = galleryItemFields.refine(
  (value) => value.kind !== 'VIDEO' || youtubeEmbedUrl(value.url) !== null,
  { message: 'Посилання не схоже на відео з YouTube', path: ['url'] },
);

export type GalleryItemInput = z.infer<typeof galleryItemInputSchema>;

export const galleryItemPatchSchema = galleryItemFields.partial();

export type GalleryItemPatch = z.infer<typeof galleryItemPatchSchema>;

/** A whole ordering at once: the screen sends the list as the studio arranged it. */
export const sortOrderInputSchema = z.object({ ids: z.array(z.uuid()).max(500) });

export type SortOrderInput = z.infer<typeof sortOrderInputSchema>;

export const testimonialInputSchema = z.object({
  authorName: z.string().trim().min(2).max(120),
  text: z.string().trim().min(10).max(2000),
  isPublished: z.boolean().default(false),
});

export type TestimonialInput = z.infer<typeof testimonialInputSchema>;

export const testimonialPatchSchema = testimonialInputSchema.partial();

export type TestimonialPatch = z.infer<typeof testimonialPatchSchema>;

/**
 * The studio opened in 2011 and an achievement is not announced years ahead,
 * so anything outside this window is a typo - `205` for `2025`, or a slip of
 * an extra digit that a smallint column would reject with a database error
 * instead of a message next to the field.
 */
export const STUDIO_FOUNDED = 2011;

export const achievementInputSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: optionalText(2000),
  year: z.coerce
    .number()
    .int()
    .min(STUDIO_FOUNDED)
    .max(new Date().getFullYear() + 1),
  imageUrl: optionalText(500),
  isPublished: z.boolean().default(false),
});

export type AchievementInput = z.infer<typeof achievementInputSchema>;

export const achievementPatchSchema = achievementInputSchema.partial();

export type AchievementPatch = z.infer<typeof achievementPatchSchema>;

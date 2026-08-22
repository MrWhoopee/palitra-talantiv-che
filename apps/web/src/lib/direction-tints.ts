/**
 * A colour per subject, for the show.
 *
 * The site itself is one violet and one orange, and it should stay that way -
 * a page that changes colour under the reader is a page that cannot be
 * trusted. The show is the other half of the same site, where every track has
 * its own light, and a teacher of guitar should not be lit the same as a
 * teacher of voice.
 *
 * Keyed by the direction's slug, which the studio sets in the cabinet. A
 * subject nobody thought of yet is lit by the fallback rather than by nothing.
 */
const DIRECTION_TINTS: Record<string, string> = {
  vocal: '#7546d0',
  piano: '#2f4d8a',
  guitar: '#8a3f2f',
  ukulele: '#3a5b4a',
};

export const FALLBACK_TINT = '#2a1f45';

export function tintOfSlug(slug: string): string {
  return DIRECTION_TINTS[slug] ?? FALLBACK_TINT;
}

/** The first subject a teacher teaches decides the colour they stand in. */
export function tintOfSlugs(slugs: readonly string[]): string {
  for (const slug of slugs) {
    const tint = DIRECTION_TINTS[slug];
    if (tint !== undefined) return tint;
  }

  return FALLBACK_TINT;
}

import { MAIN_NAV } from '@/lib/studio';

/**
 * The site as an album: the home page, then the menu top to bottom.
 *
 * The order is `MAIN_NAV` rather than a list of its own, because a second
 * list is a second place to change the menu and the two would drift apart the
 * first time somebody added a page.
 */
export interface Track {
  href: string;
  label: string;
  /**
   * The colour this track's cover is lit in. The player wears it, so the
   * transport belongs to the scene it is standing in front of rather than
   * being one grey bar in front of all seven.
   *
   * Stated here rather than in the stylesheet because it is a property of the
   * track, and the scenes will read the same values when they are built.
   */
  tint: string;
}

/** The curtain's own red, measured off the cloth in `scene/curtains.ts`. */
const CURTAIN_RED = '#6b1020';

const TINTS: Record<string, string> = {
  '/': CURTAIN_RED,
  '/teachers': '#7546d0',
  '/directions': '#3a5b4a',
  '/groups': '#5b33a8',
  '/events': '#3a5b4a',
  '/about': '#f08a2c',
  '/contacts': '#1c1b22',
};

export const TRACKS: readonly Track[] = [{ href: '/', label: 'Головна' }, ...MAIN_NAV].map(
  (entry) => ({ ...entry, tint: TINTS[entry.href] ?? CURTAIN_RED }),
);

/**
 * Which track a page belongs to, or `null` for a page that is not one - the
 * gallery, the rules, the cabinet, the login screen.
 *
 * A page below a track counts as that track: somebody reading a teacher's own
 * page is still in Teachers, and the player has to keep saying where they are
 * rather than losing them one click in.
 */
export function trackIndex(pathname: string): number | null {
  const path = normalise(pathname);

  // The home page matches exactly and nothing else. Every path begins with a
  // slash, so a prefix match here would swallow the whole site.
  if (path === '/') return 0;

  const found = TRACKS.findIndex(
    (track) => track.href !== '/' && (path === track.href || path.startsWith(`${track.href}/`)),
  );

  return found === -1 ? null : found;
}

export interface TrackPosition {
  track: Track;
  /** Counted from one, the way the caption reads it. */
  number: number;
  total: number;
}

export function trackAt(index: number | null): TrackPosition | null {
  if (index === null) return null;

  const track = TRACKS[index];
  if (track === undefined) return null;

  return { track, number: index + 1, total: TRACKS.length };
}

/**
 * The tracks either side. Deliberately not circular: the player says "track 7
 * of 7", and a seventh that led back to the first would contradict its own
 * caption.
 *
 * From a page that is no track at all there is nothing behind - but there is
 * still a way in, which is the point of showing the player there.
 */
export function neighbours(index: number | null): { previous: Track | null; next: Track | null } {
  if (index === null) return { previous: null, next: TRACKS[0] ?? null };

  return {
    previous: index > 0 ? (TRACKS[index - 1] ?? null) : null,
    next: TRACKS[index + 1] ?? null,
  };
}

export type Stage = 'curtain' | 'wall';

/**
 * Which screen `/` is showing, read from the address so that the browser's
 * back button walks from the wall to the curtain rather than off the site,
 * and so a link to the wall can be sent to somebody.
 *
 * Anything that is not the one name is the curtain: the value comes from a
 * query string, and a query string is written by whoever is typing.
 */
export function stageFromSearch(value: string | null | undefined): Stage {
  return value === 'wall' ? 'wall' : 'curtain';
}

/** Without the query string, and without a trailing slash except at the root. */
function normalise(pathname: string): string {
  const path = (pathname.split('?')[0] ?? '').split('#')[0] ?? '';
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);

  return path === '' ? '/' : path;
}

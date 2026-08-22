/**
 * Which of the site's two skins a visitor gets.
 *
 * `calm` is the site itself: redesigned, alive under the pointer, but quiet.
 * `show` adds the curtain and the previews on top of it - stage 8 hangs that
 * on the same attribute, which is why the switch exists before the show does.
 */
export type Skin = 'show' | 'calm';

export const SKIN_COOKIE = 'pt-skin';

/** A year: the choice is about a person, not about a session. */
export const SKIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Reads the cookie header and decides.
 *
 * Deliberately self-contained - no imports, no calls to neighbours, only
 * `String` methods. This function is serialised into the inline script in the
 * document head (see `SKIN_SCRIPT`), and after minification a call to a
 * helper would point at a name that is not in the serialised text.
 */
export function resolveSkin(cookie: string, prefersReducedMotion: boolean): Skin {
  // Asking for less motion is a statement about the person rather than a
  // preference about this site, so it outranks both the cookie and the
  // first-visit default.
  if (prefersReducedMotion) return 'calm';

  const parts = String(cookie || '').split(';');
  for (const raw of parts) {
    const part = raw.trim();
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    // The name is spelled out rather than read from `SKIN_COOKIE` for the
    // same reason there are no helper calls: this text is serialised.
    if (part.slice(0, eq) !== 'pt-skin') continue;
    // Anything that is not the one name a visitor can choose reads as no
    // choice at all - the value arrives in a header they control.
    return part.slice(eq + 1) === 'calm' ? 'calm' : 'show';
  }

  // Nobody has chosen yet: the studio opens with the curtain up.
  return 'show';
}

/**
 * The inline script that stamps `data-skin` on `<html>` before the first
 * frame.
 *
 * It runs here rather than on the server because reading the cookie in the
 * root layout would make every page dynamic, and `/rules` and `/contacts` are
 * static today. The serialised function is bound to a local name, so a
 * minifier is free to rename the original.
 */
export const SKIN_SCRIPT = `(function(){try{var r=${resolveSkin.toString()};document.documentElement.dataset.skin=r(document.cookie,matchMedia(${JSON.stringify(REDUCED_MOTION_QUERY)}).matches)}catch(e){}})()`;

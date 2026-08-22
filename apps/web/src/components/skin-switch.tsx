'use client';

import { useEffect, useState } from 'react';
import {
  REDUCED_MOTION_QUERY,
  resolveSkin,
  SKIN_COOKIE,
  SKIN_COOKIE_MAX_AGE,
  type Skin,
} from '@/lib/skin';

/**
 * Turns the show off and on.
 *
 * It exists before the show does, on purpose: a switch added afterwards is a
 * switch retrofitted into every page that had already assumed one skin. Until
 * stage 8 it changes an attribute nothing reads yet - and that is the whole
 * cost of having it early.
 *
 * The label is rendered only after mount. Which skin is on is decided in the
 * browser, so the server has no way to know what to write here, and a button
 * whose text changes under the visitor's eyes reads as a glitch.
 */
export function SkinSwitch() {
  const [skin, setSkin] = useState<Skin | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia(REDUCED_MOTION_QUERY).matches;

    setReduced(prefersReduced);
    setSkin(resolveSkin(document.cookie, prefersReduced));
  }, []);

  // Someone who asked for less motion has already answered this question in
  // their system settings. Offering them the show would be asking twice and
  // honouring neither answer.
  if (skin === null || reduced) return null;

  const next: Skin = skin === 'show' ? 'calm' : 'show';

  function choose() {
    document.cookie = `${SKIN_COOKIE}=${next}; path=/; max-age=${SKIN_COOKIE_MAX_AGE}; samesite=lax`;
    document.documentElement.dataset['skin'] = next;
    setSkin(next);
  }

  return (
    <button className="skin-switch" onClick={choose} type="button" aria-pressed={skin === 'show'}>
      <span className="skin-switch__dot" aria-hidden="true" />
      {skin === 'show' ? 'Вимкнути анімації' : 'Увімкнути анімації'}
    </button>
  );
}

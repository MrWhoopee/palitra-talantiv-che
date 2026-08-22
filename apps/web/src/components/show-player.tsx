'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SkinSwitch } from '@/components/skin-switch';
import { REDUCED_MOTION_QUERY } from '@/lib/skin';
import { neighbours, trackAt, trackIndex } from '@/lib/tracks';

/**
 * The transport that stays.
 *
 * It is the whole reason the show is navigable rather than a thing you enter
 * and then leave: the arrows go straight to the next track, so the site can
 * be paged through without returning to the shelf every time.
 *
 * Rendered on every public page, and only in the show skin. It is a client
 * island and reads nothing from the server, so `/rules` and `/contacts` stay
 * static - which is the point of stamping the skin in the document head
 * rather than reading a cookie in a layout.
 */
export function ShowPlayer() {
  const pathname = usePathname();
  const showing = useShowSkin();
  const [pageName, setPageName] = useState('');

  // For a page that is not a track - the gallery, the rules, the cabinet -
  // the caption is the page's own name, which the document already knows.
  useEffect(() => {
    setPageName((document.title.split(' — ')[0] ?? '').trim());
  }, [pathname]);

  if (!showing) return null;

  const index = trackIndex(pathname);
  const position = trackAt(index);
  const { previous, next } = neighbours(index);

  return (
    <nav className="player" aria-label="Треки студії">
      {/* What is playing, on the left, the way a player says it. */}
      <p className="player__now">
        <span className="player__label">{position === null ? pageName : position.track.label}</span>
        {position === null ? null : (
          <span className="player__count">
            трек {position.number} з {position.total}
          </span>
        )}
      </p>

      <div className="player__transport">
        <Step track={previous} direction="previous" />

        {/* Play opens the cover - the scene a track starts from. It is the
            middle of the transport because it is the thing the arrows are
            arranged around, the same way it is on anything that plays. */}
        <Link className="player__play" href="/?stage=wall">
          <span aria-hidden="true">▶</span>
          <span className="visually-hidden">Грати: обкладинка</span>
        </Link>

        <Step track={next} direction="next" />
      </div>

      {/* The way out of the show, always within reach. The footer has the
          same switch, and the footer is a scroll away. */}
      <div className="player__aside">
        <SkinSwitch />
      </div>
    </nav>
  );
}

/**
 * An arrow with somewhere to go is a link; one without is a disabled button
 * rather than a missing element, so the row keeps its shape at both ends of
 * the album and nothing shifts under the pointer.
 */
function Step({
  track,
  direction,
}: {
  track: { href: string; label: string } | null;
  direction: 'previous' | 'next';
}) {
  const symbol = direction === 'previous' ? '◀' : '▶';
  const wording = direction === 'previous' ? 'Попередній трек' : 'Наступний трек';

  if (track === null) {
    return (
      <span className="player__step" aria-hidden="true" data-spent="">
        {symbol}
      </span>
    );
  }

  return (
    <Link className="player__step" href={track.href} title={`${wording}: ${track.label}`}>
      <span aria-hidden="true">{symbol}</span>
      <span className="visually-hidden">
        {wording}: {track.label}
      </span>
    </Link>
  );
}

/**
 * Whether the show is on, watched rather than read once: the switch in the
 * footer changes the attribute in place, and a player that only looked at
 * mount would stay on screen after somebody turned the show off.
 */
function useShowSkin(): boolean {
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    // Reduced motion resolves to the calm skin, and `resolveSkin` has already
    // decided that before this ever runs. Checked again here only because a
    // player is the one piece that would otherwise outlive the decision.
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;

    const read = () => setShowing(root.dataset['skin'] === 'show');
    read();

    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['data-skin'] });

    return () => observer.disconnect();
  }, []);

  return showing;
}

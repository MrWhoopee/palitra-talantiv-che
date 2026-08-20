import type { CSSProperties } from 'react';

/**
 * The studio's own mark, turned into a component: a bar with a filled part and
 * the playhead at its end.
 *
 * It renders only where there is time to show - a lesson's length, a teacher's
 * day, an event from start to finish. Used as decoration under a heading it
 * would stop meaning anything, and the logo would lose the one idea it has.
 */
export function Track({ percent }: { percent: number }) {
  const filled = Math.min(100, Math.max(0, percent));

  // Through a custom property rather than `width` and `left` directly: an
  // inline style can only be overridden with `!important`, and the hero needs
  // to run the playhead to the end on hover without shouting.
  return (
    <span
      className="track"
      aria-hidden="true"
      style={{ '--track-fill': `${filled}%` } as CSSProperties}
    >
      <span className="track__fill" />
      <span className="track__knob" />
    </span>
  );
}

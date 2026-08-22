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

  // The sweep is a third element rather than the fill running to the end on
  // hover, and that is not a stylistic choice. A custom property written
  // inline cannot be overridden from a stylesheet, and transitioning the
  // property instead - registered with `@property`, as the light around a
  // border is - freezes it at its starting value in Chrome rather than
  // interpolating. Both were measured. A plain `transform` between two
  // literals is the one thing that reliably moves.
  //
  // It also tells the truth better: the filled part means a length of time,
  // and time does not grow because a pointer passed over it.
  return (
    <span
      className="track"
      aria-hidden="true"
      style={{ '--track-fill': `${filled}%` } as CSSProperties}
    >
      <span className="track__fill" />
      <span className="track__knob" />
      <span className="track__sweep" />
    </span>
  );
}

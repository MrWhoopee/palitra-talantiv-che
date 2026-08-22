'use client';

import { useEffect, useRef } from 'react';
import { REDUCED_MOTION_QUERY } from '@/lib/skin';

/**
 * Everything that answers the pointer, in one layer behind the document.
 *
 * A sibling of the content, never a wrapper around it: the public shell is
 * server-rendered from top to bottom, and a component with `children` here
 * would pull all of it into the client for the sake of a background.
 *
 * Both modules are imported after the first frame. Neither is on the path to
 * anything the visitor came to read, so neither belongs in the bundle that
 * paints the page.
 */
export function PointerLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const notes = notesRef.current;
    if (canvas === null || notes === null) return;

    // Three ways of not having this, all of them ordinary rather than
    // exceptional: someone asked for less motion; there is no pointer to
    // follow, which is every phone; the browser cannot draw it.
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    let stopRipples: (() => void) | undefined;
    let stopNotes: (() => void) | undefined;
    let cancelled = false;

    const idle =
      window.requestIdleCallback?.bind(window) ??
      ((run: () => void) => window.setTimeout(run, 200));

    idle(() => {
      if (cancelled) return;

      void Promise.all([import('@/lib/ripples'), import('@/lib/notes')]).then(
        ([{ startRipples }, { startNotes }]) => {
          if (cancelled) return;

          stopRipples = startRipples(canvas, readTint())?.stop;
          stopNotes = startNotes(notes).stop;
        },
      );
    });

    return () => {
      cancelled = true;
      stopRipples?.();
      stopNotes?.();
    };
  }, []);

  return (
    <>
      <canvas className="pointer-water" ref={canvasRef} aria-hidden="true" />
      <div className="pointer-notes" ref={notesRef} aria-hidden="true" />
    </>
  );
}

/**
 * The water is tinted with the site's own accent, read from the stylesheet
 * rather than repeated here - a second copy of `#7546d0` is a second thing to
 * change when the studio's colour changes.
 */
function readTint(): [number, number, number] {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--pt-primary').trim();

  const hex = /^#([0-9a-f]{6})$/i.exec(value)?.[1];
  if (hex === undefined) return [0.46, 0.27, 0.82];

  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

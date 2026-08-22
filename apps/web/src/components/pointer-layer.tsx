'use client';

import { useEffect, useRef } from 'react';
import { REDUCED_MOTION_QUERY } from '@/lib/skin';

/**
 * Everything that answers the pointer, in one layer behind the document.
 *
 * The pointer rules a stave and leaves a note over anything worth pressing.
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

    let stopStaff: (() => void) | undefined;
    let stopNotes: (() => void) | undefined;
    let cancelled = false;

    const idle =
      window.requestIdleCallback?.bind(window) ??
      ((run: () => void) => window.setTimeout(run, 200));

    idle(() => {
      if (cancelled) return;

      void Promise.all([import('@/lib/staff'), import('@/lib/notes')]).then(
        ([{ startStaff }, { startNotes }]) => {
          if (cancelled) return;

          stopStaff = startStaff(canvas, readInk())?.stop;
          stopNotes = startNotes(notes).stop;
        },
      );
    });

    return () => {
      cancelled = true;
      stopStaff?.();
      stopNotes?.();
    };
  }, []);

  return (
    <>
      <canvas className="pointer-staff" ref={canvasRef} aria-hidden="true" />
      <div className="pointer-notes" ref={notesRef} aria-hidden="true" />
    </>
  );
}

/**
 * The stave is ruled in the studio's own violet, read from the stylesheet
 * rather than repeated here - a second copy of `#7546d0` is a second thing to
 * change when the studio's colour changes.
 */
function readInk(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--pt-primary').trim();

  return value === '' ? '#7546d0' : value;
}

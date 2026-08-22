'use client';

import { useEffect, useRef, useState } from 'react';
import type { PropStandScene } from '@/components/show-scenes/prop-stand';
import '@/styles/show-scene.css';

/**
 * The bench the prop library is looked at on.
 *
 * Every prop the show owns, stood under the one warm light the rooms are lit
 * by and turned slowly. It exists because the Blender viewport is not the
 * answer: a prop is judged by how it reads in the room it will stand in, and
 * that room is dark.
 *
 * A demo route, so three.js is loaded here and the real site never sees it.
 */

/** Grows as `assets/blender/props/` does. */
const NAMES = ['chair', 'door'];

export function DemoProps() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PropStandScene | null>(null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    let disposed = false;
    const portrait = () => window.innerHeight > window.innerWidth;

    void import('@/components/show-scenes/prop-stand')
      .then(({ createPropStand }) =>
        createPropStand({
          canvas,
          quality: window.matchMedia('(pointer: coarse)').matches ? 'low' : 'high',
          portrait: portrait(),
          names: NAMES,
          onProgress: (loaded, total) => setProgress(loaded / total),
        }),
      )
      .then((scene) => {
        if (disposed) {
          scene.dispose();
          return;
        }

        sceneRef.current = scene;
        scene.resize(window.innerWidth, window.innerHeight, portrait());
        // Not left to `onProgress` to finish the count: the library is loaded
        // once per session, so the second page to ask for it gets no progress
        // events at all - only the answer. Done is known from the promise.
        setProgress(1);
      })
      // A missing prop throws by name from `props.ts`, and the point of this
      // page is to read that message rather than to stare at a black canvas.
      .catch((error: unknown) => setFailed(error instanceof Error ? error.message : String(error)));

    const onResize = () =>
      sceneRef.current?.resize(window.innerWidth, window.innerHeight, portrait());

    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // `data-open` from the start: the shared stylesheet keeps the panel hidden
  // until a scene's curtain is drawn, and the bench has no curtain to draw.
  return (
    <main className="scene" data-open="">
      <canvas className="scene__canvas" ref={canvasRef} />

      <div className="scene__panel">
        <p className="scene__eyebrow">Бібліотека реквізиту</p>
        <h1 className="scene__title">{NAMES.join(' · ')}</h1>
        <p className="scene__meta">
          {/* «У бібліотеці: 1» замість «1 предметів»: число тут росте, а
              відмінювати іменник заради лави реквізиту — зайва машинерія. */}
          {failed ??
            (progress < 1 ? `${Math.round(progress * 100)}%` : `У бібліотеці: ${NAMES.length}`)}
        </p>
      </div>
    </main>
  );
}

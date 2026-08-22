'use client';

import { useEffect, useRef, useState } from 'react';
import type { HallScene } from '@/components/show-scenes/hall';
import '@/styles/show-scene.css';

/**
 * The hall on its own, before it is the room behind the first door.
 *
 * Scroll walks down the aisle. Kept as a demo route while the stage is still
 * missing its curtain, so it can be looked at without the corridor in the way.
 */
export function DemoHall() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HallScene | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    let disposed = false;
    const portrait = () => window.innerHeight > window.innerWidth;

    void import('@/components/show-scenes/hall')
      .then(({ createHall }) =>
        createHall({
          canvas,
          quality: window.matchMedia('(pointer: coarse)').matches ? 'low' : 'high',
          portrait: portrait(),
        }),
      )
      .then((scene) => {
        if (disposed) {
          scene.dispose();
          return;
        }

        sceneRef.current = scene;
        scene.resize(window.innerWidth, window.innerHeight, portrait());
      })
      .catch((error: unknown) => setFailed(error instanceof Error ? error.message : String(error)));

    const onResize = () =>
      sceneRef.current?.resize(window.innerWidth, window.innerHeight, portrait());

    // One gesture, two acts: the first two thirds walk down the aisle, the
    // last third draws the curtain. Walking and opening at once would be two
    // things moving for one scroll, and neither would read.
    const onScroll = () => {
      const span = document.documentElement.scrollHeight - window.innerHeight;
      const progress = span > 0 ? window.scrollY / span : 0;

      sceneRef.current?.setApproach(Math.min(1, progress / 0.66));
      sceneRef.current?.setCurtain(Math.max(0, (progress - 0.66) / 0.34));
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <main className="scene" data-open="" style={{ minHeight: '220dvh' }}>
      <canvas className="scene__canvas" ref={canvasRef} />

      <div className="scene__panel">
        <p className="scene__eyebrow">трек 1 з 7</p>
        <h1 className="scene__title">Зала</h1>
        <p className="scene__meta">{failed ?? 'Прокрути: пройти залою, потім відкрити завісу'}</p>
      </div>
    </main>
  );
}

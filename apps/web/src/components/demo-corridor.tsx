'use client';

import { useEffect, useRef, useState } from 'react';
import type { CorridorScene } from '@/components/show-scenes/corridor';
import { TRACKS } from '@/lib/tracks';
import '@/styles/show-scene.css';

/**
 * The corridor, on its own, before it is the wall.
 *
 * Seven doors and the arrows that walk between them - everything the real
 * stage needs except the curtain it arrives from. Kept as a demo route while
 * it is being built so it can be looked at without the show's own state
 * standing in the way.
 */
export function DemoCorridor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CorridorScene | null>(null);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    let disposed = false;
    const portrait = () => window.innerHeight > window.innerWidth;

    void import('@/components/show-scenes/corridor')
      .then(({ createCorridor }) =>
        createCorridor({
          canvas,
          quality: window.matchMedia('(pointer: coarse)').matches ? 'low' : 'high',
          portrait: portrait(),
          doors: TRACKS.map((track) => ({ label: track.label, tint: track.tint })),
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

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setIndex((at) => Math.min(TRACKS.length - 1, at + 1));
      if (event.key === 'ArrowLeft') setIndex((at) => Math.max(0, at - 1));
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setIndex(index);
  }, [index]);

  const track = TRACKS[index];

  return (
    <main className="scene" data-open="">
      <canvas className="scene__canvas" ref={canvasRef} />

      <div className="scene__panel">
        <p className="scene__eyebrow">
          трек {index + 1} з {TRACKS.length}
        </p>
        <h1 className="scene__title">{track?.label ?? ''}</h1>
        <p className="scene__meta">{failed ?? '← → щоб пройти коридором'}</p>
      </div>
    </main>
  );
}

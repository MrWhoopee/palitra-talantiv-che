'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { HallScene } from '@/components/show-scenes/hall';
import { isCurtainOpen, setCurtainOpen, watchAttributes } from '@/lib/show';
import '@/styles/show-scene.css';

/**
 * The hall, behind the first door.
 *
 * Scroll walks down the aisle; the player draws the curtain. That is the whole
 * reason `data-curtain` has the name it has - until now it stood for "this
 * track's scene is open", which was an abstraction over seven different
 * gestures. Here it is a curtain, and play is the person who pulls it.
 *
 * The scene arrives on entering the room and not before: three.js and the prop
 * library are behind a dynamic import, so a visitor who never opened this door
 * never paid for what is behind it.
 */
export function ShowHall() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HallScene | null>(null);
  const [progress, setProgress] = useState(0);
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
        scene.setCurtain(isCurtainOpen(document.documentElement) ? 1 : 0);
        setProgress(1);
      })
      .catch((error: unknown) => setFailed(error instanceof Error ? error.message : String(error)));

    const onResize = () =>
      sceneRef.current?.resize(window.innerWidth, window.innerHeight, portrait());

    const onScroll = () => {
      const span = document.documentElement.scrollHeight - window.innerHeight;
      sceneRef.current?.setApproach(span > 0 ? window.scrollY / span : 0);
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

  // Shut on arrival, so play is the thing that opens it rather than the room
  // arriving already opened by whatever the last page left behind.
  useEffect(() => {
    const root = document.documentElement;
    setCurtainOpen(root, false);

    return watchAttributes(root, () => {
      sceneRef.current?.setCurtain(isCurtainOpen(root) ? 1 : 0);
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }

      // Out of the room and back into the corridor - which is also where the
      // browser's own back button goes, because the door pushed an address.
      if (event.key === 'Escape') router.push('/');
    };

    window.addEventListener('keydown', onKey, true);

    return () => window.removeEventListener('keydown', onKey, true);
  }, [router]);

  return (
    <main className="scene" data-open="" style={{ minHeight: '220dvh' }}>
      <canvas className="scene__canvas" ref={canvasRef} />

      <div className="scene__panel">
        <p className="scene__eyebrow">трек 1 з 7</p>
        <h1 className="scene__title">Зала</h1>
        <p className="scene__meta">
          {failed ??
            (progress < 1
              ? `${Math.round(progress * 100)}%`
              : 'Прокрути залою · play — відкрити завісу · Esc — у коридор')}
        </p>
      </div>
    </main>
  );
}

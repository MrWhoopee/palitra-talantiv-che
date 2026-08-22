'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { CorridorScene } from '@/components/show-scenes/corridor';
import { isCurtainOpen, setCurtainOpen, watchAttributes } from '@/lib/show';
import { TRACKS } from '@/lib/tracks';
import '@/styles/show-scene.css';

/**
 * The studio's corridor, standing where stage 8 put the wall of covers.
 *
 * Seven doors, and the arrows walk between them. Opening one is a real
 * navigation to a real page - the corridor is the site's own menu wearing a
 * building, not an imitation of one, which is why the links below the canvas
 * are links and not handlers on a `div`.
 */
export function ShowCorridor() {
  const router = useRouter();
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

    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setIndex(index);
  }, [index]);

  // The keys the show promised in stage 8 §9.
  //
  // On the window rather than the canvas, because the corridor fills the
  // screen and a canvas has to be focused before it hears anything. In the
  // capture phase because the bubble phase is not ours to rely on: Escape was
  // being swallowed before it ever arrived, by a listener further down that
  // stopped it. Capture on the window runs before all of them.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Except where somebody is typing. Nothing here takes text, but the
      // corridor is mounted inside the site's own shell and this listener
      // outranks everything in it.
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }

      if (event.key === 'ArrowRight') {
        setIndex((at) => Math.min(TRACKS.length - 1, at + 1));
        return;
      }

      if (event.key === 'ArrowLeft') {
        setIndex((at) => Math.max(0, at - 1));
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        const track = TRACKS[index];
        if (track === undefined) return;

        event.preventDefault();
        router.push(track.href);
        return;
      }

      // Nothing to escape from any more: the corridor is where the site
      // opens, so there is no screen behind it to go back to.
    };

    window.addEventListener('keydown', onKey, true);

    return () => window.removeEventListener('keydown', onKey, true);
  }, [index, router]);

  // Play means "open what is in front of you", and in the corridor that is the
  // door. The player already has the control and already says which track it
  // is on, so a second button here would be a second way to say the same
  // thing. Shut on arrival so the button is armed rather than showing pause
  // for a scene nobody opened.
  const chosen = useRef(index);
  chosen.current = index;

  useEffect(() => {
    const root = document.documentElement;
    setCurtainOpen(root, false);

    return watchAttributes(root, () => {
      if (!isCurtainOpen(root)) return;

      const track = TRACKS[chosen.current];
      if (track !== undefined) router.push(track.href);
    });
  }, [router]);

  const track = TRACKS[index];

  return (
    <main className="scene" data-open="">
      <canvas className="scene__canvas" ref={canvasRef} />

      <div className="scene__panel">
        <p className="scene__eyebrow">
          трек {index + 1} з {TRACKS.length}
        </p>
        <h1 className="scene__title">{track?.label ?? ''}</h1>
        <p className="scene__meta">{failed ?? '← → коридором · Enter — увійти'}</p>
      </div>

      {/*
        The seven doors as seven links.
        A corridor drawn on a canvas is invisible to Tab, to a screen reader
        and to the middle mouse button, and stage 8 §9 was explicit that the
        show stays navigation rather than an impression of it. Focusing one
        walks the camera to its door, so the two ways through agree.
      */}
      <nav className="scene__doors" aria-label="Треки студії">
        {TRACKS.map((entry, at) => (
          <Link
            key={entry.href}
            href={entry.href}
            onFocus={() => setIndex(at)}
            aria-current={at === index ? 'true' : undefined}
          >
            {entry.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}

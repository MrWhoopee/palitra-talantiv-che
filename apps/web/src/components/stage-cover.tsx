'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Stage } from '@/components/demo-stage/scene';
import { isCurtainOpen, readSkin, watchAttributes } from '@/lib/show';
import { REDUCED_MOTION_QUERY } from '@/lib/skin';

/**
 * The home page's cover: the real stage, with its curtain shut and the mark
 * hanging in front of it. Play draws the cloth back and the camera walks in
 * from the house; pause draws it shut and the mark comes back.
 *
 * This is the scene from the demo branch rather than a curtain painted in CSS.
 * The painted one was cheaper and looked well enough, and it was not what the
 * studio asked for: a velvet gradient is a picture of a curtain, and this is
 * a curtain.
 *
 * It costs what it costs. three.js is around a hundred and fifty kilobytes,
 * loaded here and nowhere else, and only once somebody is in the show skin -
 * a visitor who turned the animations off never pays for it, and neither does
 * anyone who arrived on another page.
 */
export function StageCover() {
  const pathname = usePathname();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const [showing, setShowing] = useState(false);
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    const read = () => {
      setShowing(readSkin(root) === 'show');
      setOpen(isCurtainOpen(root));
    };

    read();

    return watchAttributes(root, read);
  }, []);

  const wanted = pathname === '/' && showing;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!wanted || canvas === null) return;
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;

    let disposed = false;
    const portrait = () => window.innerHeight > window.innerWidth;

    void import('@/components/demo-stage/scene').then(async ({ createStage }) => {
      if (disposed) return;

      const stage = await createStage({
        canvas,
        // A coarse pointer means a phone: no shadows, no bloom, a capped
        // pixel ratio, and its own camera path.
        quality: window.matchMedia('(pointer: coarse)').matches ? 'low' : 'high',
        portrait: portrait(),
        logoUrl: '/logo-mark.svg',
        // Once the cloth is fully back the stage has been seen; the page
        // underneath is what the visitor came for, so the scene steps aside.
        onOpened: () => setGone(true),
      });

      if (disposed) {
        stage.dispose();
        return;
      }

      stageRef.current = stage;
      stage.resize(window.innerWidth, window.innerHeight, portrait());
    });

    const onResize = () =>
      stageRef.current?.resize(window.innerWidth, window.innerHeight, portrait());
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      stageRef.current?.dispose();
      stageRef.current = null;
    };
  }, [wanted]);

  // The player writes the attribute; the scene follows it. Two directions, one
  // source of truth - and the cloth runs the same path both ways.
  useEffect(() => {
    if (open) {
      stageRef.current?.open();
      return;
    }

    stageRef.current?.close();
    setGone(false);
  }, [open]);

  if (!wanted) return null;

  return (
    <div className="stage-cover" data-gone={gone ? '' : undefined} aria-hidden="true">
      <canvas className="stage-cover__canvas" ref={canvasRef} />
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FINALE_FROM, JOURNEY_SCREENS, STATIONS } from './stations';
import type { Stage } from './scene';

/**
 * The page around the stage: it decides whether the scene may run at all, mounts
 * it, and paints the words that ride along with it.
 *
 * The overlay is never re-rendered from scroll. React draws the blocks once and
 * the scroll handler writes a custom property straight onto each element, so a
 * flick of the wheel costs a style write rather than a render pass.
 */

type Mode = 'pending' | 'scene' | 'poster';
type Phase = 'closed' | 'opening' | 'open';

function hasWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'));
  } catch {
    return false;
  }
}

function smooth(t: number): number {
  const c = Math.min(Math.max(t, 0), 1);
  return c * c * (3 - 2 * c);
}

/** How present a block is at this point in the journey: fades in before its
 *  dwell begins and out once the camera has left. */
function presence(progress: number, from: number, to: number): number {
  const arriving = smooth((progress - (from - 0.07)) / 0.07);
  const leaving = smooth((progress - to) / 0.06);
  return arriving * (1 - leaving);
}

export function StageExperience() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blocksRef = useRef<(HTMLElement | null)[]>([]);
  const stageRef = useRef<Stage | null>(null);
  const [mode, setMode] = useState<Mode>('pending');
  const [phase, setPhase] = useState<Phase>('closed');

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setMode(reduced || !hasWebGL() ? 'poster' : 'scene');
  }, []);

  const paint = useCallback((progress: number) => {
    for (let i = 0; i < STATIONS.length; i += 1) {
      const station = STATIONS[i]!;
      const block = blocksRef.current[i];
      if (block)
        block.style.setProperty(
          '--pt-presence',
          String(presence(progress, station.from, station.to)),
        );
    }
    const finale = blocksRef.current[STATIONS.length];
    if (finale) {
      finale.style.setProperty('--pt-presence', String(smooth((progress - FINALE_FROM) / 0.05)));
    }
  }, []);

  useEffect(() => {
    if (mode !== 'scene') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    const isPortrait = () => window.innerHeight > window.innerWidth;

    void (async () => {
      const { createStage } = await import('./scene');
      if (disposed) return;
      const stage = await createStage({
        canvas,
        // A coarse pointer means a phone or a tablet, which means no shadows,
        // no bloom and a capped pixel ratio.
        quality: window.matchMedia('(pointer: coarse)').matches ? 'low' : 'high',
        portrait: isPortrait(),
        logoUrl: '/logo-mark.svg',
        onOpened: () => setPhase('open'),
      });
      if (disposed) {
        stage.dispose();
        return;
      }
      stageRef.current = stage;
      stage.resize(window.innerWidth, window.innerHeight, isPortrait());
    })();

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const span = document.documentElement.scrollHeight - window.innerHeight;
        const progress = span > 0 ? window.scrollY / span : 0;
        stageRef.current?.setProgress(progress);
        paint(progress);
      });
    };

    const onResize = () => {
      stageRef.current?.resize(window.innerWidth, window.innerHeight, isPortrait());
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      stageRef.current?.dispose();
      stageRef.current = null;
    };
  }, [mode, paint]);

  // Nothing to scroll to until the curtain has gone.
  useEffect(() => {
    if (mode !== 'scene') return;
    const locked = phase !== 'open';
    document.body.style.overflow = locked ? 'hidden' : '';
    if (locked) window.scrollTo(0, 0);
    return () => {
      document.body.style.overflow = '';
    };
  }, [mode, phase]);

  const open = () => {
    if (phase !== 'closed') return;
    setPhase('opening');
    stageRef.current?.open();
  };

  const blocks = (
    <div className="stage__overlay">
      {STATIONS.map((station, index) => (
        <article
          key={station.id}
          className="stage__block"
          data-station={station.id}
          ref={(element) => {
            blocksRef.current[index] = element;
          }}
        >
          <p className="stage__eyebrow">{station.eyebrow}</p>
          <h2 className="stage__title">{station.title}</h2>
          <p className="stage__body">{station.body}</p>
          <span className="stage__cta">{station.cta}</span>
        </article>
      ))}
      <article
        className="stage__block stage__block--finale"
        ref={(element) => {
          blocksRef.current[STATIONS.length] = element;
        }}
      >
        <h2 className="stage__title">Палітра талантів</h2>
        <p className="stage__body">Музична студія в Черкасах. Сцена чекає на вас.</p>
        <span className="stage__cta">Обрати напрям</span>
      </article>
    </div>
  );

  if (mode === 'poster') {
    return (
      <main className="stage stage--poster">
        <div className="stage__poster">
          <img src="/logo-mark.svg" alt="Палітра талантів" className="stage__poster-mark" />
          <p className="stage__body">Музична студія в Черкасах.</p>
        </div>
        <div className="stage__list">
          {STATIONS.map((station) => (
            <article key={station.id} className="stage__block stage__block--static">
              <p className="stage__eyebrow">{station.eyebrow}</p>
              <h2 className="stage__title">{station.title}</h2>
              <p className="stage__body">{station.body}</p>
              <span className="stage__cta">{station.cta}</span>
            </article>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="stage" data-phase={phase}>
      <canvas className="stage__canvas" ref={canvasRef} />
      <div className="stage__vignette" aria-hidden="true" />
      {phase !== 'open' && (
        <button
          type="button"
          className="stage__enter"
          onClick={open}
          disabled={phase === 'opening'}
          aria-label="Відкрити завісу"
        />
      )}
      {blocks}
      <div className="stage__journey" style={{ height: `${JOURNEY_SCREENS * 100}vh` }} />
    </main>
  );
}

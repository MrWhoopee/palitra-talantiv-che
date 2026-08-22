'use client';

import { lessonSharePercent, type Direction, type PricePlan } from '@palitra/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DirectionsScene } from '@/components/show-scenes/directions';
import { tintOfSlug } from '@/lib/direction-tints';
import { isCurtainOpen, readSkin, watchAttributes } from '@/lib/show';
import { REDUCED_MOTION_QUERY } from '@/lib/skin';
import { formatMinutes, formatUah } from '@/lib/studio';
import '@/styles/show-scene.css';

/**
 * The subjects in the show: the page's own track list, standing up.
 *
 * The cover is four slats holding the lengths this subject is taught in; play
 * slides them apart, and behind them the same lengths are lying across the
 * floor as beams with the price lit at the far end. Scrolling walks from one
 * subject to the next.
 *
 * The data is the page's own - the same directions, the same price plans. A
 * scene with its own copy of the prices would be a second price list.
 */

export function ShowDirections({
  directions,
  plans,
}: {
  directions: readonly Direction[];
  plans: readonly PricePlan[];
}) {
  const pathname = usePathname();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<DirectionsScene | null>(null);
  const [showing, setShowing] = useState(false);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);

  // The page draws the same numbers from the same two lists; doing it once
  // here keeps the scene and the words underneath from ever disagreeing.
  const cards = useMemo(
    () =>
      directions.map((direction) => ({
        id: direction.id,
        slug: direction.slug,
        name: direction.name,
        description: direction.description,
        tint: tintOfSlug(direction.slug),
        lessons: singleLessons(plans, direction.id),
      })),
    [directions, plans],
  );

  useEffect(() => {
    const root = document.documentElement;

    const read = () => {
      setShowing(readSkin(root) === 'show');
      setOpen(isCurtainOpen(root));
    };

    read();

    return watchAttributes(root, read);
  }, []);

  const live = pathname === '/directions' && showing && cards.length > 0;

  useEffect(() => {
    if (!live) return;

    const root = document.documentElement;
    root.setAttribute('data-show-scene', '');

    return () => root.removeAttribute('data-show-scene');
  }, [live]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!live || canvas === null) return;
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;

    let disposed = false;
    const portrait = () => window.innerHeight > window.innerWidth;

    void import('@/components/show-scenes/directions').then(({ createDirectionsScene }) => {
      if (disposed) return;

      const scene = createDirectionsScene({
        canvas,
        quality: window.matchMedia('(pointer: coarse)').matches ? 'low' : 'high',
        portrait: portrait(),
        directions: cards.map((card) => ({
          id: card.id,
          tint: card.tint,
          lessons: card.lessons.map((lesson) => ({
            share: lessonSharePercent(lesson.durationMinutes) / 100,
            priceUah: lesson.perLesson,
          })),
        })),
      });

      sceneRef.current = scene;
      scene.resize(window.innerWidth, window.innerHeight, portrait());
      // The slats may already be apart if play was pressed before the scene
      // had finished loading.
      scene.setOpen(isCurtainOpen(document.documentElement));
    });

    const onScroll = () => {
      const span = document.documentElement.scrollHeight - window.innerHeight;
      const progress = span > 0 ? window.scrollY / span : 0;
      const index = progress * (cards.length - 1);

      sceneRef.current?.setIndex(index);
      setCurrent(Math.round(index));
    };

    const onResize = () =>
      sceneRef.current?.resize(window.innerWidth, window.innerHeight, portrait());

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [live, cards]);

  useEffect(() => {
    sceneRef.current?.setOpen(open);
  }, [open]);

  useEffect(() => {
    if (!live) return;

    document.body.style.overflow = open ? '' : 'hidden';
    if (!open) window.scrollTo(0, 0);

    return () => {
      document.body.style.overflow = '';
    };
  }, [live, open]);

  if (!live) return null;

  const card = cards[Math.min(current, cards.length - 1)]!;

  return (
    <main className="scene" data-open={open ? '' : undefined}>
      <canvas className="scene__canvas" ref={canvasRef} />

      <div className="scene__panel">
        <p className="scene__eyebrow">
          {current + 1} / {cards.length}
        </p>
        <h1 className="scene__title">{card.name}</h1>

        {card.description === null ? null : <p className="scene__body">{card.description}</p>}

        {card.lessons.length === 0 ? (
          <p className="scene__meta">Ціни уточнюються</p>
        ) : (
          <ul className="scene__list">
            {card.lessons.map((lesson) => (
              <li className="scene__row" key={lesson.id}>
                <span>{formatMinutes(lesson.durationMinutes)}</span>
                <span className="scene__value">{formatUah(Math.round(lesson.perLesson))}</span>
              </li>
            ))}
          </ul>
        )}

        <Link className="scene__cta" href={`/directions/${card.slug}`}>
          Про напрям →
        </Link>
      </div>

      <div className="scene__rail" style={{ height: `${cards.length * 100}vh` }} />
    </main>
  );
}

/**
 * One row per length a lesson is sold in, shortest first, counted once - the
 * same rule the ordinary page reads the price list by. Two identical bars
 * beside each other would read as two different lessons.
 */
function singleLessons(plans: readonly PricePlan[], directionId: string) {
  const byDuration = new Map<number, { id: string; durationMinutes: number; perLesson: number }>();

  for (const plan of plans) {
    if (plan.directionId !== directionId || plan.format !== 'INDIVIDUAL') continue;

    const perLesson = plan.priceUah / plan.lessonsCount;
    const kept = byDuration.get(plan.durationMinutes);
    // The cheaper way to buy that length is the one worth showing.
    if (kept === undefined || perLesson < kept.perLesson) {
      byDuration.set(plan.durationMinutes, {
        id: plan.id,
        durationMinutes: plan.durationMinutes,
        perLesson,
      });
    }
  }

  return [...byDuration.values()].sort((a, b) => a.durationMinutes - b.durationMinutes);
}

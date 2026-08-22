'use client';

import type { PublicTeacher } from '@palitra/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { TeachersScene } from '@/components/show-scenes/teachers';
import { readSkin, watchAttributes } from '@/lib/show';
import { REDUCED_MOTION_QUERY } from '@/lib/skin';
import '@/styles/show-scene.css';

/**
 * The teachers page in the show: pick somebody.
 *
 * A cut-out of the teacher on one side, their colour washing the room behind
 * them, their name and what they teach on the other, and the scroll walking
 * along the row. The ordinary page is not on screen while this is; it is
 * still in the HTML, so what a crawler reads has not changed.
 *
 * The data is the page's own - the same teachers, the same links. A scene
 * with its own copy of the roster would be a second thing to keep true.
 */

/** Stand-ins until the studio sends photographs; the shape of a person, no more. */
const FIGURES = [
  '/demo/figures/figure-1.png',
  '/demo/figures/figure-2.png',
  '/demo/figures/figure-3.png',
  '/demo/figures/figure-4.png',
];

/** A teacher is lit in the colour of what they teach. */
const DIRECTION_TINTS: Record<string, string> = {
  vocal: '#7546d0',
  piano: '#2f4d8a',
  guitar: '#8a3f2f',
  ukulele: '#3a5b4a',
};

const FALLBACK_TINT = '#2a1f45';

export function ShowTeachers({ teachers }: { teachers: readonly PublicTeacher[] }) {
  const pathname = usePathname();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<TeachersScene | null>(null);
  const [showing, setShowing] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setShowing(readSkin(root) === 'show');

    read();

    return watchAttributes(root, read);
  }, []);

  const live = pathname === '/teachers' && showing && teachers.length > 0;

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

    void import('@/components/show-scenes/teachers').then(({ createTeachersScene }) => {
      if (disposed) return;

      const scene = createTeachersScene({
        canvas,
        quality: window.matchMedia('(pointer: coarse)').matches ? 'low' : 'high',
        portrait: portrait(),
        teachers: teachers.map((teacher, index) => ({
          id: teacher.id,
          figureUrl: teacher.photoUrl ?? FIGURES[index % FIGURES.length]!,
          tint: tintOf(teacher),
        })),
      });

      sceneRef.current = scene;
      scene.resize(window.innerWidth, window.innerHeight, portrait());
    });

    // The scroll walks along the row: one screen of scrolling per teacher.
    const onScroll = () => {
      const span = document.documentElement.scrollHeight - window.innerHeight;
      const progress = span > 0 ? window.scrollY / span : 0;
      const index = progress * (teachers.length - 1);

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
  }, [live, teachers]);

  if (!live) return null;

  const teacher = teachers[Math.min(current, teachers.length - 1)]!;

  return (
    <main className="scene">
      <canvas className="scene__canvas" ref={canvasRef} />

      <div className="scene__panel">
        <p className="scene__eyebrow">
          {current + 1} / {teachers.length}
        </p>
        <h1 className="scene__title">
          {teacher.firstName} {teacher.lastName}
        </h1>

        <p className="scene__meta">
          {teacher.directions.map((direction) => direction.name).join(' · ') || 'Викладач студії'}
        </p>

        {teacher.bio === null ? null : <p className="scene__body">{teacher.bio}</p>}

        <p className="scene__meta">
          {teacher.experienceYears === null
            ? 'Досвід уточнюється'
            : `Досвід ${teacher.experienceYears} р.`}
          {teacher.locations.length === 0
            ? ''
            : ` · ${teacher.locations.map((location) => location.name).join(', ')}`}
        </p>

        <Link className="scene__cta" href={`/teachers/${teacher.id}`}>
          Вільний час →
        </Link>
      </div>

      {/* Something to scroll along: one screen per teacher, which is what the
          progress above is measured against. */}
      <div className="scene__rail" style={{ height: `${teachers.length * 100}vh` }} />
    </main>
  );
}

function tintOf(teacher: PublicTeacher): string {
  for (const direction of teacher.directions) {
    const tint = DIRECTION_TINTS[direction.slug];
    if (tint !== undefined) return tint;
  }

  return FALLBACK_TINT;
}

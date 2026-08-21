import {
  lessonSharePercent,
  type Direction,
  type PricePlan,
  type PublicTeacher,
  type StudioEvent,
} from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/json-ld';
import { Track } from '@/components/track';
import { Prose } from '@/components/prose';
import { api } from '@/lib/api';
import { readSiteCopy } from '@/lib/site-content';
import { musicSchoolJsonLd } from '@/lib/seo';
import { formatEventDate } from '@/lib/studio-time';
import { STUDIO } from '@/lib/studio';
import '@/styles/home.css';

export const metadata: Metadata = {
  title: 'Палітра талантів — музична студія в Черкасах',
  description:
    'Вокал, фортепіано, гітара та укулеле для дітей і дорослих. Дві локації в Черкасах, перше заняття безкоштовне.',
  alternates: { canonical: '/' },
};

export const dynamic = 'force-dynamic';

/**
 * Each section reads its own data and disappears when it has none, so the page
 * never shows an empty frame with a heading over it. A studio that has not
 * given us photographs yet still gets a finished home page.
 */
export default async function HomePage() {
  const [directions, plans, teachers, events, copy] = await Promise.all([
    safely(() => api.getDirections(), [] as Direction[]),
    safely(() => api.getPricePlans(), [] as PricePlan[]),
    safely(() => api.getTeachers(), [] as PublicTeacher[]),
    safely(() => api.getEvents('upcoming'), [] as StudioEvent[]),
    readSiteCopy('home'),
  ]);

  const tracks = directions.map((direction) => ({
    direction,
    minutes: shortestLesson(plans, direction.id),
  }));

  return (
    <main>
      <JsonLd data={musicSchoolJsonLd()} />

      <section className="hero">
        <div className="container">
          <p className="eyebrow">
            {STUDIO.city} · з {STUDIO.since} року
          </p>
          {/* The studio's own opening where it has written one. Everything
              below the hero is built from the database, so it stands whether
              or not anybody has ever opened the cabinet. */}
          <h1 className="hero__title">{copy?.title ?? 'Музична студія для дітей і дорослих'}</h1>
          {copy ? (
            <div className="hero__lead site-copy">
              <Prose blocks={copy.blocks} />
            </div>
          ) : (
            <p className="hero__lead">
              Вокал, фортепіано, гітара та укулеле. Індивідуальні заняття й ансамблі — від чотирьох
              років і без верхньої межі.
            </p>
          )}

          <p className="hero__actions">
            <Link href="/teachers" className="button-primary">
              Обрати викладача
            </Link>
            <Link href="/groups" className="button-quiet">
              Групи та ансамблі
            </Link>
            <span className="hero__note">Перше заняття безкоштовне</span>
          </p>

          {tracks.length === 0 ? null : (
            <ul className="hero-track">
              {tracks.map(({ direction, minutes }) => (
                <li key={direction.id}>
                  <Link href={`/directions/${direction.slug}`} className="hero-track__item">
                    <span className="hero-track__name">{direction.name}</span>
                    <Track percent={lessonSharePercent(minutes)} />
                    <span className="hero-track__time">{minutes} хвилин</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="container section facts">
        <Fact value={`${new Date().getFullYear() - STUDIO.since}`} label="років студії" />
        <Fact value={`${teachers.length}`} label="викладачів" />
        <Fact value={`${STUDIO.locations.length}`} label="локації в Черкасах" />
        <Fact value={`${directions.length}`} label="напрями" />
      </section>

      {teachers.length === 0 ? null : (
        <section className="container section">
          <div className="section-head">
            <h2>Хто навчає</h2>
            <Link href="/teachers">Усі викладачі →</Link>
          </div>
          <ul className="card-grid card-grid--plain">
            {teachers.slice(0, 4).map((teacher) => (
              <li key={teacher.id}>
                <Link href={`/teachers/${teacher.id}`} className="card">
                  <p className="eyebrow">
                    {teacher.directions.map((direction) => direction.name).join(' · ')}
                  </p>
                  <p className="card__title">
                    {teacher.firstName} {teacher.lastName}
                  </p>
                  {teacher.bio ? <p className="card__text">{teacher.bio}</p> : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {events.length === 0 ? null : (
        <section className="container section">
          <div className="section-head">
            <h2>Найближчі події</h2>
            <Link href="/events">Уся афіша →</Link>
          </div>
          <ul className="card-grid card-grid--plain">
            {events.slice(0, 3).map((event) => (
              <li key={event.id}>
                <Link href={`/events/${event.slug}`} className="card">
                  <p className="eyebrow">{formatEventDate(event.startsAt)}</p>
                  <p className="card__title">{event.title}</p>
                  {event.location ? <p className="card__text">{event.location.address}</p> : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="fact">
      <span className="fact__value">{value}</span>
      <span className="fact__label">{label}</span>
    </div>
  );
}

/**
 * The shortest individual lesson the studio sells in this direction - which is
 * what "how long is a lesson" means to someone who has not booked one yet.
 * Sixty minutes when a direction has no plans, because that is the longest
 * lesson on the price list and the bar has to mean something.
 */
function shortestLesson(plans: PricePlan[], directionId: string): number {
  const durations = plans
    .filter((plan) => plan.directionId === directionId && plan.format === 'INDIVIDUAL')
    .map((plan) => plan.durationMinutes);

  return durations.length === 0 ? 60 : Math.min(...durations);
}

/**
 * A section whose data did not load renders as a section with no data, which
 * this page already knows how to handle: it disappears. The alternative - one
 * failed request taking down the whole home page - is worse.
 */
async function safely<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch {
    return fallback;
  }
}

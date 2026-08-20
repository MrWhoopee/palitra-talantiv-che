import { lessonSharePercent, type Direction, type PricePlan } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Track } from '@/components/track';
import { api } from '@/lib/api';
import { openGraphFor } from '@/lib/seo';
import { formatMinutes, formatUah } from '@/lib/studio';
import '@/styles/content.css';

const TITLE = 'Напрями — Палітра талантів';
const DESCRIPTION =
  'Вокал, фортепіано, гітара та укулеле в студії «Палітра талантів». Тривалість заняття й ціни за кожним напрямом.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/directions' },
  openGraph: openGraphFor({ title: TITLE, description: DESCRIPTION, path: '/directions' }),
};

export const dynamic = 'force-dynamic';

/**
 * The four things the studio teaches, each with the two numbers a parent asks
 * first: how long a lesson lasts and what it costs. The bar is the duration
 * against an hour, so the answer is visible before the price list is read.
 */
export default async function DirectionsPage() {
  const [directions, plans] = await Promise.all([
    api.getDirections().catch(() => [] as Direction[]),
    api.getPricePlans().catch(() => [] as PricePlan[]),
  ]);

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Чого навчаємо</p>
        <h1 className="page-title">Напрями</h1>
        <p className="page-lede">
          Голос і три інструменти. Заняття індивідуальні або в групі — від чотирьох років і без
          верхньої межі.
        </p>
      </header>

      {directions.length === 0 ? (
        <p className="empty-state">
          Перелік напрямів готується. Тим часом <Link href="/teachers">оберіть викладача</Link> —
          вільний час видно одразу.
        </p>
      ) : (
        <ul className="card-grid card-grid--plain">
          {directions.map((direction) => {
            const own = plans.filter((plan) => plan.directionId === direction.id);
            const minutes = shortestLesson(own);
            const cheapest = cheapestLesson(own);

            return (
              <li key={direction.id}>
                <Link href={`/directions/${direction.slug}`} className="card">
                  <p className="card__title">{direction.name}</p>
                  {direction.description ? (
                    <p className="card__text">{direction.description}</p>
                  ) : null}

                  {minutes === null ? null : (
                    <span className="track-row measure">
                      <Track percent={lessonSharePercent(minutes)} />
                      <span className="measure__value">{formatMinutes(minutes)}</span>
                    </span>
                  )}

                  <p className="card__price">
                    {cheapest === null ? 'Ціни уточнюються' : `від ${formatUah(cheapest)}`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

/** The shortest lesson sold in a direction: what "a lesson" means there. */
function shortestLesson(plans: PricePlan[]): number | null {
  const durations = plans.map((plan) => plan.durationMinutes);
  return durations.length === 0 ? null : Math.min(...durations);
}

/**
 * The lowest price per lesson, not the lowest price on the list: a package of
 * eight costs more than a single lesson and would read as the expensive
 * option, which is the opposite of what it is.
 */
function cheapestLesson(plans: PricePlan[]): number | null {
  const perLesson = plans.map((plan) => Math.round(plan.priceUah / plan.lessonsCount));
  return perLesson.length === 0 ? null : Math.min(...perLesson);
}

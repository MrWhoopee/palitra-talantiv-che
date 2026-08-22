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
        <ul className="directions" data-reveal-group>
          {directions.map((direction) => {
            const own = singleLessons(plans, direction.id);

            return (
              <li key={direction.id}>
                <Link href={`/directions/${direction.slug}`} className="direction">
                  <span className="direction__about">
                    <span className="direction__name">{direction.name}</span>
                    {direction.description ? (
                      <span className="direction__text">{direction.description}</span>
                    ) : null}
                  </span>

                  {/* Every length this direction is taught in, drawn against
                      an hour. Not "from 350 UAH": a parent choosing between
                      thirty minutes and an hour is choosing between two
                      different lessons, and the price list is the only place
                      that has ever said so. */}
                  {own.length === 0 ? (
                    <span className="direction__pending">Ціни уточнюються</span>
                  ) : (
                    <span className="direction__plans">
                      {own.map((plan) => (
                        <span className="direction__plan" key={plan.id}>
                          <Track percent={lessonSharePercent(plan.durationMinutes)} />
                          <span className="direction__minutes">
                            {formatMinutes(plan.durationMinutes)}
                          </span>
                          <span className="direction__price">
                            {formatUah(Math.round(plan.priceUah / plan.lessonsCount))}
                          </span>
                        </span>
                      ))}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

/**
 * One row per length a lesson is sold in, shortest first, counted once. A
 * direction usually has both a single lesson and a package at the same
 * length, and two identical bars beside each other would read as two
 * different lessons.
 */
function singleLessons(plans: PricePlan[], directionId: string): PricePlan[] {
  const byDuration = new Map<number, PricePlan>();

  for (const plan of plans) {
    if (plan.directionId !== directionId || plan.format !== 'INDIVIDUAL') continue;

    const perLesson = plan.priceUah / plan.lessonsCount;
    const kept = byDuration.get(plan.durationMinutes);
    // The cheaper way to buy that length is the one worth showing.
    if (kept === undefined || perLesson < kept.priceUah / kept.lessonsCount) {
      byDuration.set(plan.durationMinutes, plan);
    }
  }

  return [...byDuration.values()].sort((a, b) => a.durationMinutes - b.durationMinutes);
}

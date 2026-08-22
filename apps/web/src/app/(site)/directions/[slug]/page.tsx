import {
  lessonSharePercent,
  type Direction,
  type Group,
  type PricePlan,
  type PublicTeacher,
} from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Track } from '@/components/track';
import { api } from '@/lib/api';
import { openGraphFor } from '@/lib/seo';
import { formatMinutes, formatUah } from '@/lib/studio';
import { describeGroupSchedule } from '@/lib/studio-time';
import '@/styles/content.css';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const direction = await loadDirection(slug);

  if (!direction) {
    return { title: 'Напрям не знайдено — Палітра талантів' };
  }

  const description =
    direction.description ?? `${direction.name} у студії «Палітра талантів», Черкаси.`;

  return {
    title: `${direction.name} — Палітра талантів`,
    description,
    alternates: { canonical: `/directions/${direction.slug}` },
    openGraph: openGraphFor({
      title: `${direction.name} — Палітра талантів`,
      description,
      path: `/directions/${direction.slug}`,
    }),
  };
}

export const dynamic = 'force-dynamic';

/**
 * One direction, answered in the order the questions come: what it is, how
 * long a lesson lasts and what it costs, who teaches it, and which groups are
 * taking people.
 */
export default async function DirectionPage({ params }: PageProps) {
  const { slug } = await params;
  const direction = await loadDirection(slug);

  if (!direction) {
    notFound();
  }

  const [plans, teachers, groups] = await Promise.all([
    api.getPricePlans().catch(() => [] as PricePlan[]),
    api.getTeachers().catch(() => [] as PublicTeacher[]),
    api.getGroups().catch(() => [] as Group[]),
  ]);

  const own = plans.filter((plan) => plan.directionId === direction.id);
  const individual = own.filter((plan) => plan.format === 'INDIVIDUAL');
  const inGroup = own.filter((plan) => plan.format === 'GROUP');
  const theirs = teachers.filter((teacher) =>
    teacher.directions.some((taught) => taught.id === direction.id),
  );
  const open = groups.filter(
    (group) => group.direction.id === direction.id && group.isOpenForEnrollment,
  );

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">
          <Link href="/directions">Напрями</Link>
        </p>
        <h1 className="page-title">{direction.name}</h1>
        {direction.description ? <p className="page-lede">{direction.description}</p> : null}
        <p className="page-actions">
          <Link href="/teachers" className="button-primary">
            Записатись на пробне
          </Link>
        </p>
      </header>

      {own.length === 0 ? null : (
        <section className="section" data-reveal>
          <div className="section-head">
            <h2>Скільки коштує</h2>
          </div>
          <PlanList title="Індивідуально" plans={individual} />
          <PlanList title="У групі" plans={inGroup} />
        </section>
      )}

      {theirs.length === 0 ? null : (
        <section className="section" data-reveal>
          <div className="section-head">
            <h2>Хто навчає</h2>
            <Link href="/teachers">Усі викладачі →</Link>
          </div>
          <ul className="card-grid card-grid--plain" data-reveal-group>
            {theirs.map((teacher) => (
              <li key={teacher.id}>
                <Link href={`/teachers/${teacher.id}`} className="card">
                  <p className="card__title">
                    {teacher.firstName} {teacher.lastName}
                  </p>
                  {teacher.bio ? <p className="card__text">{teacher.bio}</p> : null}
                  <p className="eyebrow">
                    {teacher.locations.map((location) => location.name).join(' · ')}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {open.length === 0 ? null : (
        <section className="section" data-reveal>
          <div className="section-head">
            <h2>Групи, що набирають</h2>
            <Link href="/groups">Усі групи →</Link>
          </div>
          <ul className="card-grid card-grid--plain" data-reveal-group>
            {open.map((group) => (
              <li key={group.id}>
                <Link href={`/groups/${group.id}`} className="card">
                  <p className="card__title">{group.name}</p>
                  <p className="card__text">{describeGroupSchedule(group.schedule)}</p>
                  <p className="eyebrow">
                    {group.location.name} · {group.seatsLeft} вільних місць
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/**
 * A price list where the bar is the lesson's length against an hour. It is the
 * one comparison a table of numbers hides: two plans at the same price are not
 * the same offer if one lesson is half as long.
 */
function PlanList({ title, plans }: { title: string; plans: PricePlan[] }) {
  if (plans.length === 0) {
    return null;
  }

  return (
    <>
      <h3 className="plan-list__title">{title}</h3>
      <ul className="plan-list">
        {plans.map((plan) => (
          <li key={plan.id} className="plan">
            <p className="plan__name">{plan.name}</p>
            <span className="track-row measure">
              <Track percent={lessonSharePercent(plan.durationMinutes)} />
              <span className="measure__value">{formatMinutes(plan.durationMinutes)}</span>
            </span>
            <p className="plan__price">
              {formatUah(plan.priceUah)}
              {plan.lessonsCount === 1 ? null : (
                <span className="plan__unit">
                  {' '}
                  за {plan.lessonsCount} занять ·{' '}
                  {formatUah(Math.round(plan.priceUah / plan.lessonsCount))} за заняття
                </span>
              )}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

async function loadDirection(slug: string): Promise<Direction | null> {
  try {
    return await api.getDirection(slug);
  } catch {
    return null;
  }
}

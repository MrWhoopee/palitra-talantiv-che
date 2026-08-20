import type { Achievement, Testimonial } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import { openGraphFor } from '@/lib/seo';
import '@/styles/content.css';

const TITLE = 'Досягнення — Палітра талантів';
const DESCRIPTION =
  'Перемоги на конкурсах, поїздки та відгуки учнів музичної студії «Палітра талантів».';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/achievements' },
  openGraph: openGraphFor({ title: TITLE, description: DESCRIPTION, path: '/achievements' }),
};

export const dynamic = 'force-dynamic';

/**
 * Wins and what people said about the studio. Neither is invented: a
 * competition the studio did not win and a parent who did not write anything
 * are the two things this page must never contain, so an empty list stays
 * empty.
 */
export default async function AchievementsPage() {
  const [achievements, testimonials] = await Promise.all([
    api.getAchievements().catch(() => [] as Achievement[]),
    api.getTestimonials().catch(() => [] as Testimonial[]),
  ]);

  const years = groupByYear(achievements);

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Чим пишаємось</p>
        <h1 className="page-title">Досягнення</h1>
        <p className="page-lede">Конкурси, поїздки й виступи, на яких грали й співали наші учні.</p>
      </header>

      {years.length === 0 && testimonials.length === 0 ? (
        <p className="empty-state">
          Список перемог готується. Тим часом подивіться, <Link href="/teachers">хто навчає</Link>.
        </p>
      ) : null}

      {years.map(([year, won]) => (
        <section key={year} className="section year">
          <h2 className="year__number">{year}</h2>
          <ul className="year__list">
            {won.map((achievement) => (
              <li key={achievement.id}>
                <p className="card__title">{achievement.title}</p>
                {achievement.description === null ? null : (
                  <p className="card__text">{achievement.description}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {testimonials.length === 0 ? null : (
        <section className="section">
          <div className="section-head">
            <h2>Що кажуть</h2>
          </div>
          <ul className="card-grid card-grid--plain">
            {testimonials.map((testimonial) => (
              <li key={testimonial.id}>
                <figure className="card quote">
                  <blockquote>{testimonial.text}</blockquote>
                  <figcaption className="eyebrow">{testimonial.authorName}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/**
 * Newest year first, which is the order the API already returns them in - the
 * grouping only has to keep it, not impose one.
 */
function groupByYear(achievements: Achievement[]): [number, Achievement[]][] {
  const byYear = new Map<number, Achievement[]>();

  for (const achievement of achievements) {
    const won = byYear.get(achievement.year) ?? [];
    won.push(achievement);
    byYear.set(achievement.year, won);
  }

  return [...byYear.entries()];
}

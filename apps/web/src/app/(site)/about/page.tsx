import type { Metadata } from 'next';
import Link from 'next/link';
import { Prose } from '@/components/prose';
import { api } from '@/lib/api';
import { readSiteCopy } from '@/lib/site-content';
import { openGraphFor } from '@/lib/seo';
import { STUDIO } from '@/lib/studio';
import '@/styles/content.css';

const TITLE = 'Про нас — Палітра талантів';
const DESCRIPTION =
  'Музична студія «Палітра талантів» працює в Черкасах із 2011 року: вокал, фортепіано, гітара та укулеле для дітей і дорослих.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
  openGraph: openGraphFor({ title: TITLE, description: DESCRIPTION, path: '/about' }),
};

export const dynamic = 'force-dynamic';

/**
 * Everything below the opening is either a fact we hold or a count taken from
 * the database. The opening itself is now the studio's to write: the story of
 * who founded it and why was the thing stage 5 was waiting on, and stage 6
 * handed over the pen rather than guessing at it. Until it is written the page
 * still says what is true rather than something plausible.
 */
export default async function AboutPage() {
  const [teachers, copy] = await Promise.all([
    api.getTeachers().catch(() => []),
    readSiteCopy('about'),
  ]);
  const years = new Date().getFullYear() - STUDIO.since;

  return (
    <main className="page">
      {/* The studio's own words where it has written any, and the wording
          the site was built with where it has not. What follows below is
          built rather than typed - counts, addresses, the rules the code
          actually enforces - so it stays either way: this screen lets the
          studio change how the page speaks, not what the app does. */}
      <header className="page-head">
        <p className="eyebrow">Хто ми</p>
        <h1 className="page-title">{copy?.title ?? 'Про студію'}</h1>
        {copy ? null : (
          <p className="page-lede">
            «Палітра талантів» — музична студія в Черкасах. Ми вчимо співати й грати на фортепіано,
            гітарі та укулеле — дітей і дорослих, з нуля або з будь-якого місця, де людина
            зупинилась.
          </p>
        )}
      </header>

      {copy ? (
        <div className="site-copy">
          <Prose blocks={copy.blocks} />
        </div>
      ) : null}

      <section className="section facts">
        <Fact value={`з ${STUDIO.since}`} label={`${years} років у Черкасах`} />
        <Fact value={`${teachers.length}`} label="викладачів" />
        <Fact value={`${STUDIO.locations.length}`} label="локації" />
        <Fact value="4" label="напрями" />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Як проходять заняття</h2>
        </div>
        <p className="prose">
          Заняття індивідуальні або в невеликих групах. Індивідуальне триває 30, 45 або 60 хвилин —
          залежно від віку й напряму; групи збираються за розкладом, який видно на сторінці кожної
          групи. Перше заняття безкоштовне: воно потрібне, щоб викладач і учень зрозуміли, чи
          підходять одне одному, і щоб ви побачили студію зсередини.
        </p>
        <p className="prose">
          Записатись можна самостійно: на сторінці викладача видно вільний час на чотири тижні
          вперед. Скасувати або перенести заняття теж можна самому — за добу до початку.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Де ми працюємо</h2>
          <Link href="/contacts">Контакти →</Link>
        </div>
        <ul className="card-grid card-grid--plain">
          {STUDIO.locations.map((location) => (
            <li key={location.name}>
              <div className="card">
                <p className="card__title">{location.name}</p>
                <p className="card__text">{location.address}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="page-actions">
        <Link href="/teachers" className="button-primary">
          Обрати викладача
        </Link>
        <Link href="/directions" className="button-quiet">
          Напрями та ціни
        </Link>
      </p>
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

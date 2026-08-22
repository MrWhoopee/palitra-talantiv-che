import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/json-ld';
import { Prose } from '@/components/prose';
import { musicSchoolJsonLd, openGraphFor } from '@/lib/seo';
import { readSiteCopy } from '@/lib/site-content';
import { STUDIO } from '@/lib/studio';
import '@/styles/content.css';

const TITLE = 'Контакти — Палітра талантів';
const DESCRIPTION =
  'Дві локації студії «Палітра талантів» у Черкасах і спосіб записатися на заняття.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/contacts' },
  openGraph: openGraphFor({ title: TITLE, description: DESCRIPTION, path: '/contacts' }),
};

/**
 * Two addresses and the ways to reach the studio. The phone and the social
 * links appear only once the studio gives them to us: a number invented for
 * the sake of a filled-in page is a number someone will actually dial.
 */
export default async function ContactsPage() {
  const copy = await readSiteCopy('contacts');

  return (
    <main className="page">
      <JsonLd data={musicSchoolJsonLd()} />

      {/* The studio's own words where it has written any, and the wording
          the site was built with where it has not. What follows below is
          built rather than typed - counts, addresses, the rules the code
          actually enforces - so it stays either way: this screen lets the
          studio change how the page speaks, not what the app does. */}
      <header className="page-head">
        <p className="eyebrow">Як нас знайти</p>
        <h1 className="page-title">{copy?.title ?? 'Контакти'}</h1>
        {copy ? null : (
          <p className="page-lede">
            Студія працює у двох локаціях у Черкасах. Найшвидший спосіб почати — обрати викладача й
            записатись на безкоштовне пробне заняття прямо з календаря.
          </p>
        )}
        <p className="page-actions">
          <Link href="/teachers" className="button-primary">
            Записатись на пробне
          </Link>
        </p>
      </header>

      {copy ? (
        <div className="site-copy">
          <Prose blocks={copy.blocks} />
        </div>
      ) : null}

      <section className="section" data-reveal>
        <div className="section-head">
          <h2>Локації</h2>
        </div>
        <ul className="card-grid card-grid--plain" data-reveal-group>
          {STUDIO.locations.map((location) => (
            <li key={location.name}>
              <div className="card">
                <p className="eyebrow">{STUDIO.city}</p>
                <p className="card__title">{location.name}</p>
                <p className="card__text">{location.address}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {STUDIO.phone === null && STUDIO.instagram === null ? null : (
        <section className="section" data-reveal>
          <div className="section-head">
            <h2>Зв’язок</h2>
          </div>
          <ul className="card-grid card-grid--plain" data-reveal-group>
            {STUDIO.phone === null ? null : (
              <li>
                <a className="card" href={`tel:${STUDIO.phone}`}>
                  <p className="eyebrow">Телефон</p>
                  <p className="card__title">{STUDIO.phone}</p>
                </a>
              </li>
            )}
            {STUDIO.instagram === null ? null : (
              <li>
                <a className="card" href={STUDIO.instagram} rel="noreferrer">
                  <p className="eyebrow">Соцмережі</p>
                  <p className="card__title">Instagram</p>
                </a>
              </li>
            )}
          </ul>
        </section>
      )}

      <section className="section" data-reveal>
        <div className="section-head">
          <h2>Питання про заняття</h2>
        </div>
        <p className="prose">
          Умови запису, скасування й абонементів зібрані в{' '}
          <Link href="/rules">правилах студії</Link>. Розклад груп і кількість вільних місць видно
          на сторінці кожної <Link href="/groups">групи</Link>.
        </p>
      </section>
    </main>
  );
}

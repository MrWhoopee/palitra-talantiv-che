import type { Metadata } from 'next';
import Link from 'next/link';
import { Prose } from '@/components/prose';
import { openGraphFor } from '@/lib/seo';
import { readSiteCopy } from '@/lib/site-content';
import '@/styles/content.css';

const TITLE = 'Правила студії — Палітра талантів';
const DESCRIPTION =
  'Як працює запис на заняття, скасування, безкоштовне пробне й абонементи в студії «Палітра талантів».';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/rules' },
  openGraph: openGraphFor({ title: TITLE, description: DESCRIPTION, path: '/rules' }),
};

/**
 * The rules the booking form links to, and every one of them is a rule the
 * system actually enforces - the trial counter, the twenty-four hours, the
 * held seat. Writing anything here that the code does not do would be a
 * promise nobody keeps.
 */
export default async function RulesPage() {
  const copy = await readSiteCopy('rules');

  return (
    <main className="page">
      {/* The studio's own words where it has written any, and the wording
          the site was built with where it has not. What follows below is
          built rather than typed - counts, addresses, the rules the code
          actually enforces - so it stays either way: this screen lets the
          studio change how the page speaks, not what the app does. */}
      <header className="page-head">
        <p className="eyebrow">Домовленості</p>
        <h1 className="page-title">{copy?.title ?? 'Правила студії'}</h1>
        {copy ? null : (
          <p className="page-lede">
            Коротко про те, як влаштований запис, скасування й абонементи. Ці правила діють однаково
            для всіх — саме так їх виконує сайт.
          </p>
        )}
      </header>

      {copy ? (
        <div className="site-copy">
          <Prose blocks={copy.blocks} />
        </div>
      ) : null}

      <section className="section">
        <div className="section-head">
          <h2>Пробне заняття</h2>
        </div>
        <p className="prose">
          Перше заняття безкоштовне — одне на учня, а не одне на кожного викладача. Якщо ви
          скасували пробне заняття, право на нього повертається: випадкове скасування не має
          коштувати єдиного безкоштовного заняття.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Запис</h2>
        </div>
        <p className="prose">
          Записатись можна на будь-який вільний час у межах чотирьох тижнів наперед. Вільні години
          видно на сторінці викладача; час, який уже зайнято, недоступний фізично, тож два записи на
          одну годину неможливі.
        </p>
        <p className="prose">
          Перший запис працює одразу після реєстрації. Для наступних потрібна підтверджена
          електронна пошта — на неї приходять нагадування про заняття.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Скасування й перенесення</h2>
        </div>
        <p className="prose">
          Скасувати заняття самостійно можна не пізніше ніж за <strong>24 години</strong> до початку
          — кнопка є в кабінеті. Пізніше цей час уже зарезервовано за вами, тож домовлятися треба з
          викладачем напряму.
        </p>
        <p className="prose">
          Заняття, скасоване менш ніж за добу, списується з абонемента. Якщо причина поважна —
          хвороба або зміни з боку студії, — викладач скасовує його без списання.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Абонементи</h2>
        </div>
        <p className="prose">
          Абонемент — це пакет занять з одним викладачем за обраним тарифом. Запис не списує заняття
          одразу, а резервує його: записатись можна, поки залишок більший за кількість уже
          заброньованих. Списання відбувається, коли викладач позначає заняття проведеним або
          пропущеним.
        </p>
        <p className="prose">
          Ціни за напрямами — на сторінці <Link href="/directions">напрямів</Link>.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Групи</h2>
        </div>
        <p className="prose">
          У групу подають заявку. Місце тримається за вами, поки викладач її розглядає, тому
          кількість вільних місць на сторінці <Link href="/groups">групи</Link> — справжня, а не
          приблизна. Якщо група вже повна, заявку прийняти неможливо.
        </p>
      </section>

      <p className="page-actions">
        <Link href="/teachers" className="button-primary">
          Записатись на заняття
        </Link>
        <Link href="/contacts" className="button-quiet">
          Контакти
        </Link>
      </p>
    </main>
  );
}

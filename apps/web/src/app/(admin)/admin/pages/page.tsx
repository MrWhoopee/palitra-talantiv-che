import type { Metadata } from 'next';
import { adminApi } from '@/lib/admin-api';
import { readAccessToken } from '@/lib/session';
import { SITE_PAGES } from '@/lib/site-pages';
import { formatEventDate } from '@/lib/studio-time';
import { SiteTextForm } from './site-text-form';

export const metadata: Metadata = {
  title: 'Сторінки — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminPagesPage() {
  const accessToken = (await readAccessToken()) ?? '';
  const texts = await adminApi.getSiteTexts(accessToken).catch(() => null);

  const byKey = new Map((texts ?? []).map((text) => [text.key, text]));

  return (
    <>
      <header className="admin-head">
        <p className="admin-eyebrow">Сайт</p>
        <h1 className="admin-title">Сторінки</h1>
        <p className="admin-lede">
          Слова на чотирьох сторінках сайту. Нові сторінки звідси не створюються — їх стільки,
          скільки в сайту адрес. Поки сторінку не збережено жодного разу, відвідувач бачить текст, з
          яким сайт зібрано.
        </p>
      </header>

      {texts === null ? (
        <p className="admin-note">Не вдалося прочитати тексти. Оновіть сторінку.</p>
      ) : (
        SITE_PAGES.map((page) => {
          const stored = byKey.get(page.key);

          return (
            <section className="admin-panel" key={page.key}>
              <h2 className="admin-panel__title">{page.label}</h2>
              <p className="admin-panel__lede">
                {page.purpose} Читається за адресою <code>{page.href}</code>.
                {stored ? ` Востаннє змінено ${formatEventDate(stored.updatedAt)}.` : ''}
              </p>

              {stored ? null : (
                <p className="admin-empty">
                  Ще не редаговано — на сайті стоїть текст із коду. Збережене тут накриє його.
                </p>
              )}

              <SiteTextForm pageKey={page.key} {...(stored ? { value: stored } : {})} />
            </section>
          );
        })
      )}
    </>
  );
}

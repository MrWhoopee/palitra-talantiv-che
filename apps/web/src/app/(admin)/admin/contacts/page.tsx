import type { Metadata } from 'next';
import Link from 'next/link';
import { adminApi } from '@/lib/admin-api';
import { readAccessToken } from '@/lib/session';
import { ContactsForm } from './contacts-form';

export const metadata: Metadata = {
  title: 'Контакти — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminContactsPage() {
  const accessToken = (await readAccessToken()) ?? '';
  const [settings, locations] = await Promise.all([
    adminApi.getSiteSettings(accessToken).catch(() => null),
    adminApi.getLocations(accessToken).catch(() => []),
  ]);

  return (
    <>
      <header className="admin-head">
        <p className="admin-eyebrow">Сайт</p>
        <h1 className="admin-title">Контакти</h1>
        <p className="admin-lede">
          Телефон, пошта й соцмережі — те, що стоїть у підвалі кожної сторінки сайту. Порожнє поле
          означає «нічого тут не писати»: рядок просто зникає, а не показує прочерк.
        </p>
      </header>

      {settings === null ? (
        <p className="admin-note">Не вдалося прочитати контакти. Оновіть сторінку.</p>
      ) : (
        <section className="admin-panel">
          <h2 className="admin-panel__title">Як із вами зв'язатися</h2>
          <ContactsForm settings={settings} />
        </section>
      )}

      <section className="admin-panel">
        <h2 className="admin-panel__title">Адреси</h2>
        <p className="admin-panel__lede">
          Адреси беруться не звідси, а з переліку локацій — того самого, за яким складається
          розклад, щоб адреса в підвалі й адреса, на яку записують дитину, не могли розійтися.
          Змінюються вони на екрані <Link href="/admin/locations">Локації</Link>.
        </p>

        {locations.length === 0 ? (
          <p className="admin-empty">Локацій ще немає.</p>
        ) : (
          <ul className="admin-list">
            {locations.map((location) => (
              <li className="admin-row" key={location.id}>
                <span className="admin-row__name">{location.name}</span>
                <span className="admin-row__meta">{location.address}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

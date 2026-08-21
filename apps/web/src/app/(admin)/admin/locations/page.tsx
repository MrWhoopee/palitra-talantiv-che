import type { Metadata } from 'next';
import { adminApi } from '@/lib/admin-api';
import { readAccessToken } from '@/lib/session';
import { LocationForm } from './location-form';

export const metadata: Metadata = {
  title: 'Локації — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminLocationsPage() {
  const accessToken = (await readAccessToken()) ?? '';
  const locations = await adminApi.getLocations(accessToken).catch(() => null);

  return (
    <>
      <header className="admin-head">
        <p className="admin-eyebrow">Студія</p>
        <h1 className="admin-title">Локації</h1>
        <p className="admin-lede">
          Адреси, за якими студія проводить заняття. З них складаються графіки викладачів, групи й
          вибір при записі, тож адресу, на якій щось стоїть, видалити не вийде.
        </p>
      </header>

      {locations === null ? (
        <p className="admin-note">Не вдалося прочитати список. Оновіть сторінку.</p>
      ) : (
        <>
          {locations.map((location) => (
            <section className="admin-panel" key={location.id}>
              <h2 className="admin-panel__title">{location.name}</h2>
              <LocationForm value={location} />
            </section>
          ))}

          <section className="admin-panel">
            <h2 className="admin-panel__title">Нова локація</h2>
            <LocationForm />
          </section>
        </>
      )}
    </>
  );
}

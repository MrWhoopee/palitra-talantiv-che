import type { Metadata } from 'next';
import { adminApi } from '@/lib/admin-api';
import { readAccessToken } from '@/lib/session';
import { DirectionForm } from './direction-form';

export const metadata: Metadata = {
  title: 'Напрями — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminDirectionsPage() {
  const accessToken = (await readAccessToken()) ?? '';
  const directions = await adminApi.getDirections(accessToken).catch(() => null);

  return (
    <>
      <header className="admin-head">
        <p className="admin-eyebrow">Студія</p>
        <h1 className="admin-title">Напрями</h1>
        <p className="admin-lede">
          Те, чого студія навчає. Кожен напрям має свою сторінку на сайті, свої тарифи й своїх
          викладачів — тому напрям із тарифами спершу треба звільнити від них.
        </p>
      </header>

      {directions === null ? (
        <p className="admin-note">Не вдалося прочитати список. Оновіть сторінку.</p>
      ) : (
        <>
          {directions.map((direction) => (
            <section className="admin-panel" key={direction.id}>
              <h2 className="admin-panel__title">{direction.name}</h2>
              <DirectionForm value={direction} />
            </section>
          ))}

          <section className="admin-panel">
            <h2 className="admin-panel__title">Новий напрям</h2>
            <DirectionForm />
          </section>
        </>
      )}
    </>
  );
}

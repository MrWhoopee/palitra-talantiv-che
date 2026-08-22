import type { Metadata } from 'next';
import { adminApi } from '@/lib/admin-api';
import { readAccessToken } from '@/lib/session';
import { AddPhotoForm, AddVideoForm } from './add-gallery-forms';
import { GalleryRow } from './gallery-row';

export const metadata: Metadata = {
  title: 'Галерея — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminGalleryPage() {
  const accessToken = (await readAccessToken()) ?? '';

  const [items, events] = await Promise.all([
    adminApi.getGalleryItems(accessToken).catch(() => null),
    adminApi.getEvents(accessToken).catch(() => []),
  ]);

  // The order the screen is showing, sent with every move so the swap is made
  // against what the person was looking at rather than against a list that may
  // have changed in another tab since.
  const order = (items ?? []).map((item) => item.id).join(',');

  return (
    <>
      <header className="admin-head">
        <p className="admin-eyebrow">Сайт</p>
        <h1 className="admin-title">Галерея</h1>
        <p className="admin-lede">
          Фото зі студії й відео з YouTube, у тому порядку, в якому їх побачать. Стрілки
          переставляють картку на одну позицію — миші тягати не треба, і з клавіатури це теж працює.
        </p>
      </header>

      <section className="admin-panel">
        <h2 className="admin-panel__title">Додати фото</h2>
        <AddPhotoForm events={events} />
      </section>

      <section className="admin-panel">
        <h2 className="admin-panel__title">Додати відео</h2>
        <p className="admin-panel__lede">
          Приймається лише посилання на YouTube: адреса потрапляє в рамку відео на сайті, і чуже
          посилання там означало б чужий код на сторінці студії.
        </p>
        <AddVideoForm events={events} />
      </section>

      {items === null ? (
        <p className="admin-note">Не вдалося прочитати галерею. Оновіть сторінку.</p>
      ) : items.length === 0 ? (
        <p className="admin-empty">У галереї ще порожньо.</p>
      ) : (
        items.map((item, index) => (
          <GalleryRow
            key={item.id}
            item={item}
            events={events}
            order={order}
            isFirst={index === 0}
            isLast={index === items.length - 1}
          />
        ))
      )}
    </>
  );
}

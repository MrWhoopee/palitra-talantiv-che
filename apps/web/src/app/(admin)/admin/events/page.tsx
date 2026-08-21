import type { Metadata } from 'next';
import Link from 'next/link';
import { adminApi } from '@/lib/admin-api';
import { EVENT_KIND_LABELS } from '@/lib/events';
import { readAccessToken } from '@/lib/session';
import { formatEventRange } from '@/lib/studio-time';
import { EventForm } from './event-form';

export const metadata: Metadata = {
  title: 'Події — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  const accessToken = (await readAccessToken()) ?? '';

  // Null rather than an empty list: "we could not ask" and "nothing has been
  // announced yet" are different things to say.
  const [events, locations] = await Promise.all([
    adminApi.getEvents(accessToken).catch(() => null),
    adminApi.getLocations(accessToken).catch(() => []),
  ]);

  return (
    <>
      <header className="admin-head">
        <p className="admin-eyebrow">Сайт</p>
        <h1 className="admin-title">Події</h1>
        <p className="admin-lede">
          Уся афіша, разом із чернетками й тим, що вже минуло. Подія потрапляє на сайт лише з
          позначкою «на сайті», а в архів переходить сама — за часом, а не за перемикачем.
        </p>
      </header>

      {events === null ? (
        <p className="admin-note">Не вдалося прочитати перелік. Оновіть сторінку.</p>
      ) : (
        <section className="admin-panel">
          <h2 className="admin-panel__title">Афіша</h2>

          {events.length === 0 ? (
            <p className="admin-empty">Подій ще немає. Перша — у формі нижче.</p>
          ) : (
            <ul className="admin-list">
              {events.map((event) => (
                <li className="admin-row" key={event.id}>
                  <Link className="admin-row__name" href={`/admin/events/${event.id}`}>
                    {event.title}
                  </Link>
                  <span className="admin-row__meta">
                    {formatEventRange(event.startsAt, event.endsAt)}
                  </span>
                  <span className="admin-row__meta">
                    {EVENT_KIND_LABELS[event.kind]} · /events/{event.slug}
                  </span>
                  <span className="admin-row__badges">
                    {event.isPublished ? null : (
                      <span className="admin-badge" data-tone="draft">
                        чернетка
                      </span>
                    )}
                    {event.coverUrl === null ? (
                      <span className="admin-badge" data-tone="wait">
                        без обкладинки
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="admin-panel">
        <h2 className="admin-panel__title">Нова подія</h2>
        <p className="admin-panel__lede">
          Адреса сторінки має бути неповторною — саме за нею подію знайдуть у пошуку й надішлють
          у месенджері.
        </p>
        <EventForm locations={locations} />
      </section>
    </>
  );
}

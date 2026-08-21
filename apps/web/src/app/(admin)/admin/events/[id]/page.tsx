import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminApi } from '@/lib/admin-api';
import { EVENT_KIND_LABELS } from '@/lib/events';
import { readAccessToken } from '@/lib/session';
import { formatEventRange } from '@/lib/studio-time';
import { EventForm } from '../event-form';

export const metadata: Metadata = {
  title: 'Подія — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accessToken = (await readAccessToken()) ?? '';

  // Found in the list rather than fetched on its own: the API has no route for
  // a single event behind `/admin`, and the playbill of a studio is a page or
  // two long. A route would be worth adding the day it is not.
  const [events, locations] = await Promise.all([
    adminApi.getEvents(accessToken).catch(() => null),
    adminApi.getLocations(accessToken).catch(() => []),
  ]);

  if (events === null) {
    return <p className="admin-note">Не вдалося прочитати подію. Оновіть сторінку.</p>;
  }

  const event = events.find((candidate) => candidate.id === id);
  if (!event) {
    notFound();
  }

  return (
    <>
      <p className="admin-back">
        <Link href="/admin/events">← До всіх подій</Link>
      </p>

      <header className="admin-head">
        <p className="admin-eyebrow">
          {EVENT_KIND_LABELS[event.kind]} · {formatEventRange(event.startsAt, event.endsAt)}
        </p>
        <h1 className="admin-title">{event.title}</h1>
        <p className="admin-lede">
          {event.isPublished ? (
            <>
              Подія на сайті, за адресою <code>/events/{event.slug}</code>.
            </>
          ) : (
            'Чернетка: на сайті події немає, поки не поставлено позначку «на сайті».'
          )}
        </p>
      </header>

      <section className="admin-panel">
        <h2 className="admin-panel__title">Картка події</h2>
        <EventForm locations={locations} value={event} />
      </section>
    </>
  );
}

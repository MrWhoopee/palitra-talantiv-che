import { eventSharePercent, type StudioEvent } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ViewTransition } from 'react';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/json-ld';
import { Track } from '@/components/track';
import { api } from '@/lib/api';
import { EVENT_KIND_LABELS } from '@/lib/events';
import { eventJsonLd, openGraphFor } from '@/lib/seo';
import { formatEventRange } from '@/lib/studio-time';
import '@/styles/content.css';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEvent(slug);

  if (!event) {
    return { title: 'Подію не знайдено — Палітра талантів' };
  }

  const title = `${event.title} — Палітра талантів`;
  const description =
    event.description ?? `${EVENT_KIND_LABELS[event.kind]} студії «Палітра талантів» у Черкасах.`;

  return {
    title,
    description,
    alternates: { canonical: `/events/${event.slug}` },
    // The event's own cover when it has one, the studio's mark otherwise.
    openGraph: openGraphFor({
      title,
      description,
      path: `/events/${event.slug}`,
      image: event.coverUrl,
    }),
  };
}

export const dynamic = 'force-dynamic';

/**
 * One event. The bar under the heading is the event itself from its start to
 * its end - empty before, filling while it happens, full once it is over - so
 * the page says at a glance which of the three it is.
 */
export default async function EventPage({ params }: PageProps) {
  const { slug } = await params;
  const event = await loadEvent(slug);

  if (!event) {
    notFound();
  }

  const startsAt = new Date(event.startsAt);
  const endsAt = event.endsAt === null ? null : new Date(event.endsAt);
  const isOver = eventSharePercent(startsAt, endsAt) === 100;

  return (
    <main className="page">
      <JsonLd data={eventJsonLd(event)} />

      <header className="page-head">
        <p className="eyebrow">
          <Link href={isOver ? '/events?when=past' : '/events'}>{isOver ? 'Архів' : 'Афіша'}</Link>{' '}
          · {EVENT_KIND_LABELS[event.kind]}
        </p>
        <ViewTransition name={`event-title-${event.slug}`}>
          <h1 className="page-title">{event.title}</h1>
        </ViewTransition>

        <p className="event-when">
          <time dateTime={event.startsAt}>{formatEventRange(event.startsAt, event.endsAt)}</time>
        </p>
        <span className="track-row measure event-track">
          <Track percent={eventSharePercent(startsAt, endsAt)} />
          <span className="measure__value">{isOver ? 'Завершено' : 'Попереду'}</span>
        </span>
      </header>

      {/* A plain <img>: the cover is a link the studio pastes in, and
          next/image would need every host it might point at declared in
          advance. Uploads and their known dimensions arrive with stage 6. */}
      {event.coverUrl === null ? null : <img className="event-cover" src={event.coverUrl} alt="" />}

      {event.description === null ? null : <p className="prose">{event.description}</p>}

      {event.location === null ? null : (
        <section className="section" data-reveal>
          <div className="section-head">
            <h2>Де</h2>
          </div>
          <p className="prose">
            {event.location.name} · {event.location.address}
            {event.location.mapUrl === null ? null : (
              <>
                {' '}
                <a href={event.location.mapUrl} rel="noreferrer">
                  на мапі →
                </a>
              </>
            )}
          </p>
        </section>
      )}

      <p className="page-actions">
        <Link href="/teachers" className="button-primary">
          Записатись на заняття
        </Link>
        <Link href="/events" className="button-quiet">
          Уся афіша
        </Link>
      </p>
    </main>
  );
}

async function loadEvent(slug: string): Promise<StudioEvent | null> {
  try {
    return await api.getEvent(slug);
  } catch {
    return null;
  }
}

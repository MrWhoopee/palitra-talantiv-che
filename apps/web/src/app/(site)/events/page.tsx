import type { StudioEvent } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ViewTransition } from 'react';
import { api } from '@/lib/api';
import { openGraphFor } from '@/lib/seo';
import {
  EVENT_KIND_LABELS,
  PLAYBILL_VIEWS,
  readPlaybillView,
  type PlaybillView,
} from '@/lib/events';
import { eventDayParts, formatEventRange } from '@/lib/studio-time';
import '@/styles/content.css';

const TITLE = 'Події — Палітра талантів';
const DESCRIPTION =
  'Концерти, відкриті уроки та конкурси музичної студії «Палітра талантів» у Черкасах.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/events' },
  openGraph: openGraphFor({ title: TITLE, description: DESCRIPTION, path: '/events' }),
};

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ when?: string }>;
}

/**
 * The playbill and the archive are the same list read in two directions, so
 * they are one page moved by the transport buttons from the logo rather than
 * two pages with a link between them. The buttons are links: the choice
 * survives a reload, can be shared, and needs no JavaScript.
 */
export default async function EventsPage({ searchParams }: PageProps) {
  const { when: requested } = await searchParams;
  const when = readPlaybillView(requested);
  const events = await api.getEvents(when).catch(() => [] as StudioEvent[]);

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Що відбувається</p>
        <h1 className="page-title">Події</h1>
        <p className="page-lede">
          Звітні концерти, відкриті уроки й конкурси. Вхід вільний, якщо не зазначено інше.
        </p>

        <nav className="transport" aria-label="Період">
          {PLAYBILL_VIEWS.map((view) => (
            <Link
              key={view.when}
              href={view.when === 'upcoming' ? '/events' : `/events?when=${view.when}`}
              className="transport__button"
              aria-current={view.when === when ? 'true' : undefined}
            >
              <span aria-hidden="true">{view.symbol}</span> {view.label}
            </Link>
          ))}
        </nav>
      </header>

      {events.length === 0 ? (
        <EmptyPlaybill when={when} />
      ) : (
        // The date is set as a date rather than read as a sentence in the
        // third line of a card. A playbill is scanned for a day, so the day is
        // what the eye should land on - which is also what makes this page
        // recognisable when it is shrunk to a cover.
        <ul className="playbill" data-reveal-group>
          {events.map((event) => {
            const opens = eventDayParts(event.startsAt);

            return (
              <li key={event.id}>
                <Link href={`/events/${event.slug}`} className="playbill__row">
                  <span className="playbill__date">
                    <span className="playbill__day">{opens.day}</span>
                    <span className="playbill__month">{opens.month}</span>
                  </span>

                  <span className="playbill__about">
                    <span className="eyebrow">{EVENT_KIND_LABELS[event.kind]}</span>
                    <ViewTransition name={`event-title-${event.slug}`}>
                      <span className="playbill__title">{event.title}</span>
                    </ViewTransition>
                    <span className="playbill__when">
                      {formatEventRange(event.startsAt, event.endsAt)}
                      {event.location ? ` · ${event.location.address}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

/**
 * A page that lives in the menu cannot disappear the way a section on the home
 * page does, so it says what is true and offers the thing the visitor came
 * for anyway.
 */
function EmptyPlaybill({ when }: { when: PlaybillView }) {
  if (when === 'past') {
    return <p className="empty-state">Архів порожній — усе, що студія зіграла, ще попереду.</p>;
  }

  return (
    <p className="empty-state">
      Афіша готується. Тим часом <Link href="/teachers">оберіть викладача</Link> — вільний час видно
      одразу.
    </p>
  );
}

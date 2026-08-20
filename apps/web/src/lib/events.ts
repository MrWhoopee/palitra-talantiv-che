import type { StudioEventKind } from '@palitra/shared';

/**
 * What each kind of event is called on the site. The enum is the studio's
 * vocabulary, not the visitor's - «OPEN_LESSON» has to become «відкритий
 * урок» somewhere, and doing it in one place keeps the playbill and the
 * event's own page saying the same word.
 */
export const EVENT_KIND_LABELS: Record<StudioEventKind, string> = {
  CONCERT: 'Концерт',
  OPEN_LESSON: 'Відкритий урок',
  COMPETITION: 'Конкурс',
  OTHER: 'Подія',
};

/**
 * The playbill runs in both directions, and the transport buttons from the
 * mark are how it is moved: back into the archive, forward into what is
 * coming, pause for everything at once.
 */
export const PLAYBILL_VIEWS = [
  { when: 'past', symbol: '◀', label: 'Архів' },
  { when: 'all', symbol: '⏸', label: 'Усі' },
  { when: 'upcoming', symbol: '▶', label: 'Афіша' },
] as const;

export type PlaybillView = (typeof PLAYBILL_VIEWS)[number]['when'];

/** Anything other than the three known views is the playbill. */
export function readPlaybillView(value: string | undefined): PlaybillView {
  return value === 'past' || value === 'all' ? value : 'upcoming';
}

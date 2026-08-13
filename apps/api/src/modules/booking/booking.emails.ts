import { formatLocalDate, formatTimeOfDay, toLocalDate, toZonedParts } from '@palitra/shared';
import { mailLayout, STUDIO_NAME } from '../../lib/mail-layout';
import type { OutgoingMail } from '../../lib/mailer';

export interface LessonMailContext {
  to: string;
  /** Who is being addressed. */
  firstName: string;
  teacherName: string;
  studentName: string;
  startsAt: Date;
  durationMinutes: number;
  locationName: string;
  locationAddress: string;
  link: string;
}

const WEEKDAYS = [
  'неділя',
  'понеділок',
  'вівторок',
  'середа',
  'четвер',
  "п'ятниця",
  'субота',
] as const;

/**
 * Times in mail are written in the studio's zone, never in UTC: the reader is
 * standing in Cherkasy, and an hour printed in UTC would send them to the
 * wrong lesson twice a year.
 */
export function formatLessonMoment(startsAt: Date): string {
  const parts = toZonedParts(startsAt);
  const weekday = WEEKDAYS[parts.weekday] ?? '';
  return `${formatLocalDate(toLocalDate(startsAt))}, ${weekday}, ${formatTimeOfDay(parts.minuteOfDay)}`;
}

function details(context: LessonMailContext) {
  return [
    {
      label: 'Коли',
      value: `${formatLessonMoment(context.startsAt)} (${context.durationMinutes} хв)`,
    },
    { label: 'Де', value: `${context.locationName}, ${context.locationAddress}` },
    { label: 'Викладач', value: context.teacherName },
    { label: 'Учень', value: context.studentName },
  ];
}

export function buildBookingRequestedMail(context: LessonMailContext): OutgoingMail {
  const intro = `${context.firstName}, ${context.studentName} записався на заняття. Підтвердьте його в кабінеті, щоб учень побачив, що все домовлено.`;

  return {
    to: context.to,
    subject: `${STUDIO_NAME}: новий запис на ${formatLessonMoment(context.startsAt)}`,
    text: plainText(intro, context),
    html: mailLayout({
      heading: 'Новий запис на заняття',
      intro,
      details: details(context),
      link: context.link,
      buttonLabel: 'Відкрити кабінет',
      footer: 'Поки заняття не підтверджене, час усе одно зарезервований за цим учнем.',
    }),
  };
}

export function buildBookingConfirmedMail(context: LessonMailContext): OutgoingMail {
  const intro = `${context.firstName}, ваше заняття підтверджене. Чекаємо вас!`;

  return {
    to: context.to,
    subject: `${STUDIO_NAME}: заняття ${formatLessonMoment(context.startsAt)} підтверджено`,
    text: plainText(intro, context),
    html: mailLayout({
      heading: 'Заняття підтверджено',
      intro,
      details: details(context),
      link: context.link,
      buttonLabel: 'Мої заняття',
      footer: 'Скасувати можна не пізніше ніж за 24 години до початку.',
    }),
  };
}

export function buildBookingCancelledMail(
  context: LessonMailContext & { reason?: string | null | undefined },
): OutgoingMail {
  const intro = `${context.firstName}, заняття скасоване.${context.reason ? ` Причина: ${context.reason}` : ''}`;

  return {
    to: context.to,
    subject: `${STUDIO_NAME}: заняття ${formatLessonMoment(context.startsAt)} скасовано`,
    text: plainText(intro, context),
    html: mailLayout({
      heading: 'Заняття скасовано',
      intro,
      details: details(context),
      link: context.link,
      buttonLabel: 'Обрати інший час',
      footer: 'Час знову вільний — його можна забронювати наново.',
    }),
  };
}

function plainText(intro: string, context: LessonMailContext): string {
  const lines = details(context).map((row) => `${row.label}: ${row.value}`);
  return `${intro}\n\n${lines.join('\n')}\n\n${context.link}`;
}

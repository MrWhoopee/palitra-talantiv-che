import { mailLayout, STUDIO_NAME } from '../../lib/mail-layout';
import type { OutgoingMail } from '../../lib/mailer';

export interface MailContext {
  to: string;
  firstName: string;
  link: string;
}

export function buildVerificationMail({ to, firstName, link }: MailContext): OutgoingMail {
  const subject = `${STUDIO_NAME}: підтвердіть свою пошту`;
  const intro = `Вітаємо, ${firstName}! Залишився один крок — підтвердіть адресу, щоб ми могли надсилати вам нагадування про заняття.`;

  return {
    to,
    subject,
    text: `${intro}\n\n${link}\n\nПосилання дійсне 24 години. Якщо ви не реєструвалися в студії, просто проігноруйте цей лист.`,
    html: mailLayout({
      heading: 'Підтвердіть пошту',
      intro,
      link,
      buttonLabel: 'Підтвердити пошту',
      footer: 'Посилання дійсне 24 години. Якщо ви не реєструвалися в студії, проігноруйте лист.',
    }),
  };
}

export function buildPasswordResetMail({ to, firstName, link }: MailContext): OutgoingMail {
  const subject = `${STUDIO_NAME}: відновлення пароля`;
  const intro = `Вітаємо, ${firstName}! Ми отримали запит на зміну пароля до вашого кабінету.`;

  return {
    to,
    subject,
    text: `${intro}\n\n${link}\n\nПосилання дійсне 1 годину. Якщо ви не просили змінити пароль, нічого робити не потрібно — пароль лишиться тим самим.`,
    html: mailLayout({
      heading: 'Новий пароль',
      intro,
      link,
      buttonLabel: 'Встановити новий пароль',
      footer:
        'Посилання дійсне 1 годину. Якщо ви не просили змінити пароль, нічого робити не потрібно.',
    }),
  };
}

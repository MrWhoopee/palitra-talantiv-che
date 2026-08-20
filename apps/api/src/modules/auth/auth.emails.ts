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

export function buildInviteMail({ to, firstName, link }: MailContext): OutgoingMail {
  const subject = `${STUDIO_NAME}: запрошення до кабінету викладача`;
  const intro = `Вітаємо, ${firstName}! Для вас створено кабінет викладача в студії «Палітра талантів». Залишилось придумати пароль — і можна складати свій графік.`;

  return {
    to,
    subject,
    text: `${intro}\n\n${link}\n\nПосилання дійсне 7 днів. Якщо ви не очікували цього листа, просто проігноруйте його — без пароля в кабінет ніхто не зайде.`,
    html: mailLayout({
      heading: 'Ваш кабінет готовий',
      intro,
      link,
      buttonLabel: 'Придумати пароль',
      footer:
        'Посилання дійсне 7 днів. Якщо ви не очікували цього листа, проігноруйте його — без пароля в кабінет ніхто не зайде.',
    }),
  };
}

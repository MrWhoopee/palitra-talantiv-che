import type { OutgoingMail } from '../../lib/mailer';

const STUDIO_NAME = 'Палітра талантів';

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
    html: layout({
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
    html: layout({
      heading: 'Новий пароль',
      intro,
      link,
      buttonLabel: 'Встановити новий пароль',
      footer:
        'Посилання дійсне 1 годину. Якщо ви не просили змінити пароль, нічого робити не потрібно.',
    }),
  };
}

interface LayoutOptions {
  heading: string;
  intro: string;
  link: string;
  buttonLabel: string;
  footer: string;
}

/**
 * Table-free, inline-styled and with the link repeated as plain text: mail
 * clients strip stylesheets, and a button that fails to render must still
 * leave something clickable behind.
 */
function layout({ heading, intro, link, buttonLabel, footer }: LayoutOptions): string {
  return `<!doctype html>
<html lang="uk">
  <body style="margin:0;padding:24px;background:#F7F3EA;font-family:Arial,Helvetica,sans-serif;color:#1C1B22;">
    <div style="max-width:520px;margin:0 auto;background:#FFFDF8;border-radius:16px;padding:32px;">
      <p style="margin:0 0 24px;color:#7B4FC9;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
        ${STUDIO_NAME}
      </p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">${escapeHtml(intro)}</p>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#F08A2C;color:#1C1B22;font-weight:bold;text-decoration:none;padding:14px 24px;border-radius:999px;">
          ${escapeHtml(buttonLabel)}
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#5A5765;">Якщо кнопка не працює, скопіюйте посилання:</p>
      <p style="margin:0 0 24px;font-size:14px;word-break:break-all;">
        <a href="${escapeHtml(link)}" style="color:#7B4FC9;">${escapeHtml(link)}</a>
      </p>
      <p style="margin:0;font-size:13px;color:#5A5765;">${escapeHtml(footer)}</p>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

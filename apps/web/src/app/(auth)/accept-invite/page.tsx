import type { Metadata } from 'next';
import Link from 'next/link';
import { FormAlert } from '@/components/form-alert';
import { AcceptInviteForm } from './accept-invite-form';

export const metadata: Metadata = {
  title: 'Запрошення — Палітра талантів',
  robots: { index: false, follow: false },
};

/**
 * Where the studio's invitation letter lands. The account already exists and
 * has no password; the one thing to do here is choose it.
 */
export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = (await searchParams)['token'];
  const value = typeof token === 'string' ? token : '';

  return (
    <>
      <p className="auth-eyebrow">Палітра талантів</p>
      <h1 className="auth-title">Ласкаво просимо</h1>

      {value ? (
        <>
          <p className="auth-lede">
            Придумайте пароль — і кабінет ваш. Далі в ньому ви ведете свій графік, бачите записи
            учнів і відмічаєте відвідування.
          </p>
          <AcceptInviteForm token={value} />
        </>
      ) : (
        <>
          <FormAlert tone="error">
            Посилання неповне. Відкрийте його з листа повністю — або попросіть студію надіслати
            запрошення ще раз.
          </FormAlert>
          <p className="auth-footnote">
            <Link href="/login">Уже маєте пароль? Увійти</Link>
          </p>
        </>
      )}
    </>
  );
}

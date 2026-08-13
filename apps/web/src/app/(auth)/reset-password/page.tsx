import type { Metadata } from 'next';
import Link from 'next/link';
import { FormAlert } from '@/components/form-alert';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = {
  title: 'Новий пароль — Палітра талантів',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = (await searchParams)['token'];
  const value = typeof token === 'string' ? token : '';

  return (
    <>
      <p className="auth-eyebrow">Палітра талантів</p>
      <h1 className="auth-title">Новий пароль</h1>

      {value ? (
        <>
          <p className="auth-lede">Придумайте пароль, який не використовуєте більше ніде.</p>
          <ResetPasswordForm token={value} />
        </>
      ) : (
        <>
          <FormAlert tone="error">
            Посилання неповне. Відкрийте його з листа повністю або запросіть нове.
          </FormAlert>
          <p className="auth-footnote">
            <Link href="/forgot-password">Запросити нове посилання</Link>
          </p>
        </>
      )}
    </>
  );
}

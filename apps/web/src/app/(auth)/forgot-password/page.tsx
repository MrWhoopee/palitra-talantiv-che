import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = {
  title: 'Відновлення пароля — Палітра талантів',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <>
      <p className="auth-eyebrow">Палітра талантів</p>
      <h1 className="auth-title">Відновлення пароля</h1>
      <p className="auth-lede">
        Надішлемо на пошту посилання, за яким можна встановити новий пароль.
      </p>

      <ForgotPasswordForm />

      <p className="auth-footnote">
        Згадали пароль? <Link href="/login">Увійти</Link>
      </p>
    </>
  );
}

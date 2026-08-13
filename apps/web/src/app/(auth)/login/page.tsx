import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/current-user';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Вхід — Палітра талантів',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  if (await getCurrentUser()) {
    redirect(safeNext(next));
  }

  return (
    <>
      <p className="auth-eyebrow">Палітра талантів</p>
      <h1 className="auth-title">Вхід у кабінет</h1>
      <p className="auth-lede">Введіть пошту й пароль, які вказували при реєстрації.</p>

      <LoginForm next={next} />

      <p className="auth-footnote">
        <Link href="/forgot-password">Забули пароль?</Link>
        {' · '}
        Ще немає кабінету?{' '}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}>
          Зареєструватися
        </Link>
      </p>
    </>
  );
}

/** Only a path on this site: an absolute `next` would be an open redirect. */
function safeNext(next: string | undefined): string {
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/cabinet';
}

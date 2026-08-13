import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/current-user';
import { RegisterForm } from './register-form';

export const metadata: Metadata = {
  title: 'Реєстрація — Палітра талантів',
  // The account pages have nothing to offer a search engine and should never
  // outrank the studio's own pages for its name.
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
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
      <h1 className="auth-title">Створення кабінету</h1>
      <p className="auth-lede">
        Кабінет потрібен, щоб бачити свої заняття, переносити й скасовувати їх без дзвінків.
      </p>

      <RegisterForm next={next} />

      <p className="auth-footnote">
        Уже маєте кабінет?{' '}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}>Увійти</Link>
      </p>
    </>
  );
}

/** Only a path on this site: an absolute `next` would be an open redirect. */
function safeNext(next: string | undefined): string {
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/cabinet';
}

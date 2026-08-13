import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import { FormAlert } from '@/components/form-alert';

export const metadata: Metadata = {
  title: 'Підтвердження пошти — Палітра талантів',
  robots: { index: false, follow: false },
};

// The page acts on the token in the link, so it must never be cached or
// prerendered - every visit is a distinct one-time confirmation.
export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = (await searchParams)['token'];
  const verified = typeof token === 'string' ? await verify(token) : false;

  return (
    <>
      <p className="auth-eyebrow">Палітра талантів</p>
      <h1 className="auth-title">Підтвердження пошти</h1>

      {verified ? (
        <FormAlert tone="ok">
          Пошту підтверджено. Тепер ми зможемо надсилати вам нагадування про заняття.
        </FormAlert>
      ) : (
        <FormAlert tone="error">
          Посилання недійсне або застаріло. Увійдіть у кабінет і запросіть новий лист.
        </FormAlert>
      )}

      <p className="auth-footnote">
        <Link href="/cabinet">Перейти в кабінет</Link>
      </p>
    </>
  );
}

async function verify(token: string): Promise<boolean> {
  try {
    await api.verifyEmail(token);
    return true;
  } catch {
    // Confirming twice is not an error worth a stack trace: mail clients
    // prefetch links, and the API answers the repeat click with success.
    return false;
  }
}

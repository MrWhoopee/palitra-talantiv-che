import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormAlert } from '@/components/form-alert';
import { getCurrentUser } from '@/lib/current-user';
import { LogoutButton } from './logout-button';
import '../../styles/auth.css';

export const metadata: Metadata = {
  title: 'Кабінет — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CabinetPage() {
  const user = await getCurrentUser();

  // The middleware already turns anonymous visitors away; this is the second
  // lock, for the case where the cookie is present but the API rejects it.
  if (!user) {
    redirect('/login');
  }

  return (
    <main className="cabinet">
      <header className="cabinet-header">
        <div>
          <p className="auth-eyebrow">Кабінет учня</p>
          <h1 className="auth-title">
            Вітаємо, {user.firstName} {user.lastName}
          </h1>
        </div>
        <LogoutButton />
      </header>

      {user.emailVerifiedAt ? null : (
        <FormAlert tone="error">
          Пошту ще не підтверджено. Відкрийте лист, який ми надіслали при реєстрації.
        </FormAlert>
      )}

      <section className="cabinet-card">
        <h2 className="auth-title">Мої заняття</h2>
        <p className="cabinet-empty">
          Записів поки немає. Запис на заняття з’явиться тут після третього етапу розробки.
        </p>

        <dl className="cabinet-facts">
          <div className="cabinet-fact">
            <dt>Пошта</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="cabinet-fact">
            <dt>Телефон</dt>
            <dd>{user.phone}</dd>
          </div>
          <div className="cabinet-fact">
            <dt>Статус пошти</dt>
            <dd>{user.emailVerifiedAt ? 'Підтверджена' : 'Не підтверджена'}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

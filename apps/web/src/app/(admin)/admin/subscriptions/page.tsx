import type { Metadata } from 'next';
import {
  cancelSubscriptionAction,
  markSubscriptionPaidAction,
} from '@/app/actions/admin-operations';
import { RowActionForm } from '@/components/row-action-form';
import { adminApi } from '@/lib/admin-api';
import { readAccessToken } from '@/lib/session';
import { formatUah } from '@/lib/studio';
import { plainDate } from '@/lib/studio-time';
import { IssueSubscriptionForm } from './issue-subscription-form';

export const metadata: Metadata = {
  title: 'Абонементи — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminSubscriptionsPage() {
  const accessToken = (await readAccessToken()) ?? '';

  const [subscriptions, students, teachers, plans] = await Promise.all([
    adminApi.getSubscriptions(accessToken).catch(() => null),
    adminApi.getStudents({}, accessToken).catch(() => []),
    adminApi.getTeachers(accessToken).catch(() => []),
    adminApi.getPricePlans(accessToken).catch(() => []),
  ]);

  // Unpaid first: this screen exists to be worked through, and what is owed is
  // the reason to open it.
  const sorted = [...(subscriptions ?? [])].sort(
    (a, b) => Number(a.paidAt !== null) - Number(b.paidAt !== null),
  );

  const owed = sorted
    .filter((one) => one.paidAt === null && one.status === 'ACTIVE')
    .reduce((sum, one) => sum + one.priceUah, 0);

  return (
    <>
      <header className="admin-head">
        <p className="admin-eyebrow">Робота</p>
        <h1 className="admin-title">Абонементи</h1>
        <p className="admin-lede">
          Продані пакети занять. Неоплачені йдуть першими — це і є причина відкрити цей екран.
          {owed > 0 ? ` Разом не оплачено: ${formatUah(owed)}.` : ''}
        </p>
      </header>

      {subscriptions === null ? (
        <p className="admin-note">Не вдалося прочитати абонементи. Оновіть сторінку.</p>
      ) : (
        <section className="admin-panel">
          <h2 className="admin-panel__title">Продані</h2>

          {sorted.length === 0 ? (
            <p className="admin-empty">Абонементів ще не продавали.</p>
          ) : (
            <ul className="admin-list">
              {sorted.map((subscription) => (
                <li className="admin-row" key={subscription.id}>
                  <span className="admin-row__name">
                    {subscription.student.lastName} {subscription.student.firstName}
                  </span>
                  <span className="admin-row__meta">
                    {subscription.planName ?? 'Тариф видалено'} ·{' '}
                    {subscription.directionName ?? 'без напряму'} · {subscription.teacher.lastName}{' '}
                    {subscription.teacher.firstName}
                  </span>
                  <span className="admin-row__meta">
                    Лишилось {subscription.lessonsLeft} з {subscription.lessonsTotal} ·{' '}
                    {plainDate(subscription.validFrom)} — {plainDate(subscription.validTo)} ·{' '}
                    {formatUah(subscription.priceUah)}
                  </span>
                  <span className="admin-row__meta">{subscription.student.phone}</span>

                  <span className="admin-row__badges">
                    {subscription.paidAt === null ? (
                      <span className="admin-badge" data-tone="wait">
                        не оплачено
                      </span>
                    ) : null}
                    {subscription.status === 'CANCELLED' ? (
                      <span className="admin-badge" data-tone="gone">
                        скасовано
                      </span>
                    ) : null}
                    {/* A package with nothing left is not a problem, but it is
                        the thing to say before anyone rings to book with it. */}
                    {subscription.lessonsLeft <= 0 && subscription.status === 'ACTIVE' ? (
                      <span className="admin-badge" data-tone="draft">
                        вичерпано
                      </span>
                    ) : null}
                  </span>

                  {subscription.status === 'ACTIVE' ? (
                    <span className="admin-row__actions">
                      {subscription.paidAt === null ? (
                        <RowActionForm
                          action={markSubscriptionPaidAction}
                          id={subscription.id}
                          label="Позначити оплаченим"
                          pendingLabel="Позначаємо…"
                        />
                      ) : null}
                      <RowActionForm
                        action={cancelSubscriptionAction}
                        id={subscription.id}
                        label="Скасувати"
                        pendingLabel="Скасовуємо…"
                        tone="danger"
                      />
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="admin-panel">
        <h2 className="admin-panel__title">Оформити абонемент</h2>
        <IssueSubscriptionForm students={students} teachers={teachers} plans={plans} />
      </section>
    </>
  );
}

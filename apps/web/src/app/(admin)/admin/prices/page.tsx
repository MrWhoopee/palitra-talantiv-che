import type { AdminDirection, AdminPricePlan } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { adminApi } from '@/lib/admin-api';
import { readAccessToken } from '@/lib/session';
import { formatUah } from '@/lib/studio';
import { PricePlanForm } from './price-plan-form';

export const metadata: Metadata = {
  title: 'Прайс — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminPricesPage() {
  const accessToken = (await readAccessToken()) ?? '';

  const [plans, directions] = await Promise.all([
    adminApi.getPricePlans(accessToken).catch(() => null),
    adminApi.getDirections(accessToken).catch(() => []),
  ]);

  return (
    <>
      <header className="admin-head">
        <p className="admin-eyebrow">Студія</p>
        <h1 className="admin-title">Прайс</h1>
        <p className="admin-lede">
          Тарифи, за якими продаються заняття й абонементи. Тариф, за яким уже щось продано, не
          видаляється — його знімають з продажу, і старі абонементи діють далі.
        </p>
      </header>

      {plans === null ? (
        <p className="admin-note">Не вдалося прочитати прайс. Оновіть сторінку.</p>
      ) : directions.length === 0 ? (
        <p className="admin-note">
          Тариф завжди належить напряму, а напрямів ще немає.{' '}
          <Link href="/admin/directions">Додайте перший напрям</Link>, і сюди можна буде вносити
          ціни.
        </p>
      ) : (
        <>
          {directions.map((direction) => (
            <DirectionPrices
              key={direction.id}
              direction={direction}
              directions={directions}
              plans={plans.filter((plan) => plan.directionId === direction.id)}
            />
          ))}

          <section className="admin-panel">
            <h2 className="admin-panel__title">Новий тариф</h2>
            <PricePlanForm directions={directions} />
          </section>
        </>
      )}
    </>
  );
}

/**
 * The plans of one subject, together. Grouped rather than listed flat because
 * that is how the studio quotes them - "скільки коштує вокал" - and because a
 * flat list of a dozen rows hides the fact that one direction has no prices
 * at all.
 */
function DirectionPrices({
  direction,
  directions,
  plans,
}: {
  direction: AdminDirection;
  directions: AdminDirection[];
  plans: AdminPricePlan[];
}) {
  return (
    <section className="admin-panel">
      <h2 className="admin-panel__title">{direction.name}</h2>

      {plans.length === 0 ? (
        <p className="admin-empty">Для цього напряму ще немає жодного тарифу.</p>
      ) : (
        // Folded shut, unlike the other reference screens. A direction can
        // carry half a dozen tariffs of eight fields each, and open they would
        // make a page several screens tall to change one price in.
        plans.map((plan) => (
          <details className="admin-subrow" key={plan.id}>
            <summary className="admin-subrow__title">
              {plan.name} · {formatUah(plan.priceUah)}
              {plan.isActive ? null : (
                <span className="admin-badge" data-tone="draft">
                  не продається
                </span>
              )}
            </summary>
            <PricePlanForm value={plan} directions={directions} />
          </details>
        ))
      )}
    </section>
  );
}

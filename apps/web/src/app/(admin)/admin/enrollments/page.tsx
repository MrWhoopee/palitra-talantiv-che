import { GROUP_ENROLLMENT_STATUSES, type GroupEnrollmentStatus } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { approveEnrollmentAction, removeEnrollmentAction } from '@/app/actions/admin-operations';
import { RowActionForm } from '@/components/row-action-form';
import { adminApi } from '@/lib/admin-api';
import { readAccessToken } from '@/lib/session';
import { formatEventDate } from '@/lib/studio-time';

export const metadata: Metadata = {
  title: 'Заявки — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<GroupEnrollmentStatus, string> = {
  PENDING: 'Чекають',
  ACTIVE: 'У групі',
  LEFT: 'Пішли',
};

/**
 * Everyone waiting to get into a group, across all of them at once.
 *
 * The teacher of a group sees its own applications in their cabinet; this is
 * the view nobody else has - the studio's, where a child waiting three weeks
 * for an answer is visible whichever group they applied to.
 */
export default async function AdminEnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const accessToken = (await readAccessToken()) ?? '';

  const status = GROUP_ENROLLMENT_STATUSES.includes(params.status as GroupEnrollmentStatus)
    ? (params.status as GroupEnrollmentStatus)
    : undefined;

  const enrollments = await adminApi
    .getEnrollments(status ? { status } : {}, accessToken)
    .catch(() => null);

  return (
    <>
      <header className="admin-head">
        <p className="admin-eyebrow">Робота</p>
        <h1 className="admin-title">Заявки</h1>
        <p className="admin-lede">
          Хто проситься в групи. Найдовше очікування — угорі, бо саме звідси цей список
          опрацьовують. Прийняти заявку в групу, де немає місць, система не дасть.
        </p>
      </header>

      <nav className="admin-filters">
        <FilterLink
          label="Чекають і в групі"
          href="/admin/enrollments"
          active={status === undefined}
        />
        {GROUP_ENROLLMENT_STATUSES.map((one) => (
          <FilterLink
            key={one}
            label={STATUS_LABELS[one]}
            href={`/admin/enrollments?status=${one}`}
            active={status === one}
          />
        ))}
      </nav>

      {enrollments === null ? (
        <p className="admin-note">Не вдалося прочитати заявки. Оновіть сторінку.</p>
      ) : enrollments.length === 0 ? (
        <p className="admin-empty">Тут порожньо.</p>
      ) : (
        <section className="admin-panel">
          <h2 className="admin-panel__title">Заявки</h2>

          <ul className="admin-list">
            {enrollments.map((enrollment) => (
              <li className="admin-row" key={enrollment.id}>
                <span className="admin-row__name">
                  {enrollment.student.lastName} {enrollment.student.firstName}
                </span>
                <span className="admin-row__meta">
                  {enrollment.group.name} · {enrollment.group.teacherName}
                </span>
                <span className="admin-row__meta">
                  {enrollment.student.phone} · {enrollment.studentEmail}
                </span>
                <span className="admin-row__meta">
                  Подано {formatEventDate(enrollment.joinedAt)}
                </span>

                <span className="admin-row__badges">
                  <span
                    className="admin-badge"
                    data-tone={enrollment.status === 'PENDING' ? 'wait' : 'draft'}
                  >
                    {STATUS_LABELS[enrollment.status].toLowerCase()}
                  </span>
                </span>

                {enrollment.status === 'LEFT' ? null : (
                  <span className="admin-row__actions">
                    {enrollment.status === 'PENDING' ? (
                      <RowActionForm
                        action={approveEnrollmentAction}
                        id={enrollment.id}
                        label="Прийняти"
                        pendingLabel="Приймаємо…"
                      />
                    ) : null}
                    <RowActionForm
                      action={removeEnrollmentAction}
                      id={enrollment.id}
                      label={enrollment.status === 'PENDING' ? 'Відхилити' : 'Вивести з групи'}
                      pendingLabel="Виконуємо…"
                      tone="danger"
                    />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="admin-back">
        <Link href="/admin/groups">← До груп</Link>
      </p>
    </>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link className="admin-filter" href={href} aria-current={active ? 'page' : undefined}>
      {label}
    </Link>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { adminApi } from '@/lib/admin-api';
import { readAccessToken } from '@/lib/session';
import { describeGroupSchedule, plainDate } from '@/lib/studio-time';

export const metadata: Metadata = {
  title: 'Групи — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Every group in the studio, read-only.
 *
 * Groups are made and changed by the teacher who runs one, from their own
 * cabinet - that is where the timetable that produces the meetings is decided,
 * and duplicating the editor here would give the studio a second way to write
 * the same rows. What the studio needs is the view a teacher cannot have: all
 * of them at once, with the places filled, and a way through to whoever is
 * waiting to get in.
 */
export default async function AdminGroupsPage() {
  const accessToken = (await readAccessToken()) ?? '';
  const groups = await adminApi.getGroups(accessToken).catch(() => null);

  return (
    <>
      <header className="admin-head">
        <p className="admin-eyebrow">Робота</p>
        <h1 className="admin-title">Групи</h1>
        <p className="admin-lede">
          Усі групи студії з наповненістю. Створює й змінює групу викладач у своєму кабінеті —
          там же складається розклад зустрічей. Заявки на вступ розглядаються на{' '}
          <Link href="/admin/enrollments">сусідньому екрані</Link>.
        </p>
      </header>

      {groups === null ? (
        <p className="admin-note">Не вдалося прочитати групи. Оновіть сторінку.</p>
      ) : groups.length === 0 ? (
        <p className="admin-empty">Груп ще немає.</p>
      ) : (
        <section className="admin-panel">
          <h2 className="admin-panel__title">Склад</h2>

          <ul className="admin-list">
            {groups.map((group) => (
              <li className="admin-row" key={group.id}>
                <Link className="admin-row__name" href={`/groups/${group.id}`}>
                  {group.name}
                </Link>
                <span className="admin-row__meta">
                  {group.direction.name} · {group.teacher.firstName} {group.teacher.lastName} ·{' '}
                  {group.location.name}
                </span>
                <span className="admin-row__meta">{describeGroupSchedule(group.schedule)}</span>
                <span className="admin-row__meta">
                  Місць зайнято {group.seatsTaken} з {group.capacity} · з{' '}
                  {plainDate(group.startsOn)}
                  {group.endsOn ? ` до ${plainDate(group.endsOn)}` : ''}
                </span>

                <span className="admin-row__badges">
                  {group.isOpenForEnrollment ? null : (
                    <span className="admin-badge" data-tone="gone">
                      набір закрито
                    </span>
                  )}
                  {group.seatsLeft <= 0 ? (
                    <span className="admin-badge" data-tone="wait">
                      немає місць
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

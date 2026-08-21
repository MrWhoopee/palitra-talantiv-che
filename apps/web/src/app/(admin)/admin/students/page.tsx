import type { Metadata } from 'next';
import Link from 'next/link';
import { adminApi } from '@/lib/admin-api';
import { readAccessToken } from '@/lib/session';
import { formatEventDate } from '@/lib/studio-time';

export const metadata: Metadata = {
  title: 'Учні — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Who the studio teaches.
 *
 * There is nothing to edit here on purpose. A student's own details belong to
 * them - they registered, and they change their name and phone in their own
 * cabinet. What the studio needs from this screen is the answer to "who do I
 * ring today": who owes for a package, and who has stopped coming.
 */
export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const accessToken = (await readAccessToken()) ?? '';
  const q = params.q ?? '';

  const students = await adminApi.getStudents(q === '' ? {} : { q }, accessToken).catch(() => null);

  return (
    <>
      <header className="admin-head">
        <p className="admin-eyebrow">Робота</p>
        <h1 className="admin-title">Учні</h1>
        <p className="admin-lede">
          Усі, кого вчить студія. Ім'я, пошта й телефон належать самій людині — вона змінює їх у
          власному кабінеті. Тут видно те, чого не видно їй: борги за абонементи й тих, хто
          перестав ходити.
        </p>
      </header>

      <section className="admin-panel">
        <h2 className="admin-panel__title">Пошук</h2>

        {/* One box against name, address and phone at once. A studio looking
            someone up has whichever of the three it was given. */}
        <form className="admin-form" method="get">
          <p className="field">
            <label className="field-label" htmlFor="q">
              Прізвище, ім'я, пошта або телефон
            </label>
            <input id="q" name="q" className="field-input" defaultValue={q} />
          </p>

          <div className="admin-row__actions">
            <button type="submit" className="admin-button admin-button--quiet">
              Знайти
            </button>
            {q === '' ? null : <Link href="/admin/students">Показати всіх</Link>}
          </div>
        </form>
      </section>

      {students === null ? (
        <p className="admin-note">Не вдалося прочитати список. Оновіть сторінку.</p>
      ) : students.length === 0 ? (
        <p className="admin-empty">
          {q === '' ? 'Учнів ще немає.' : 'За цим запитом нікого не знайшли.'}
        </p>
      ) : (
        <section className="admin-panel">
          <h2 className="admin-panel__title">
            {q === '' ? 'Усі учні' : `Знайдено: ${students.length}`}
          </h2>

          <ul className="admin-list">
            {students.map((student) => (
              <li className="admin-row" key={student.id}>
                <span className="admin-row__name">
                  {student.lastName} {student.firstName}
                </span>
                <span className="admin-row__meta">
                  {student.phone} · {student.email}
                </span>
                <span className="admin-row__meta">
                  Попереду занять: {student.upcomingLessons} · діючих абонементів:{' '}
                  {student.activeSubscriptions}
                  {student.lastLessonAt === null
                    ? ' · занять ще не було'
                    : ` · останнє заняття ${formatEventDate(student.lastLessonAt)}`}
                </span>

                <span className="admin-row__badges">
                  {student.unpaidSubscriptions > 0 ? (
                    <span className="admin-badge" data-tone="wait">
                      не оплачено абонементів: {student.unpaidSubscriptions}
                    </span>
                  ) : null}
                  {student.emailVerified ? null : (
                    <span className="admin-badge" data-tone="draft">
                      пошта не підтверджена
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

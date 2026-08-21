import type { AdminTeacher } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { adminApi } from '@/lib/admin-api';
import { readAccessToken } from '@/lib/session';
import { InviteTeacherForm } from './invite-teacher-form';

export const metadata: Metadata = {
  title: 'Викладачі — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminTeachersPage() {
  const accessToken = (await readAccessToken()) ?? '';

  // Null rather than an empty list: "we could not ask" and "nobody has been
  // invited yet" are different things to say, and only one of them is the
  // studio's fault.
  const teachers = await adminApi.getTeachers(accessToken).catch(() => null);

  return (
    <>
      <header className="admin-head">
        <p className="admin-eyebrow">Студія</p>
        <h1 className="admin-title">Викладачі</h1>
        <p className="admin-lede">
          Тут увесь склад студії — і ті, хто на сайті, і ті, хто ще ні. Видалити викладача не можна:
          на нього посилаються проведені заняття. Той, хто пішов, стає неактивним.
        </p>
      </header>

      {teachers === null ? (
        <p className="admin-note">Не вдалося прочитати список. Оновіть сторінку.</p>
      ) : (
        <section className="admin-panel">
          <h2 className="admin-panel__title">Склад</h2>

          {teachers.length === 0 ? (
            <p className="admin-empty">Ще нікого не запрошено. Почніть із форми нижче.</p>
          ) : (
            <ul className="admin-list">
              {teachers.map((teacher) => (
                <li className="admin-row" key={teacher.id}>
                  <Link className="admin-row__name" href={`/admin/teachers/${teacher.id}`}>
                    {teacher.lastName} {teacher.firstName}
                  </Link>
                  <span className="admin-row__meta">
                    {teacher.email} · {teacher.phone}
                  </span>
                  <span className="admin-row__meta">{describeSubjects(teacher)}</span>
                  <span className="admin-row__badges">
                    {teacher.hasPassword ? null : (
                      <span className="admin-badge" data-tone="wait">
                        чекає на запрошення
                      </span>
                    )}
                    {teacher.isPublished ? null : (
                      <span className="admin-badge" data-tone="draft">
                        не на сайті
                      </span>
                    )}
                    {teacher.isActive ? null : (
                      <span className="admin-badge" data-tone="gone">
                        не працює
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="admin-panel">
        <h2 className="admin-panel__title">Запросити викладача</h2>
        <p className="admin-panel__lede">
          Ми надішлемо лист із посиланням, і викладач сам придумає пароль. Пароль за нього ніхто не
          вигадує й нікому не диктує.
        </p>
        <InviteTeacherForm />
      </section>
    </>
  );
}

/** What they teach, or the reason there is nothing to show yet. */
function describeSubjects(teacher: AdminTeacher): string {
  if (teacher.directions.length === 0) {
    return 'Напрями не вказані';
  }
  return teacher.directions.map((direction) => direction.name).join(', ');
}

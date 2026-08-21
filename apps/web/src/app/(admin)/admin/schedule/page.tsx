import type { Lesson } from '@palitra/shared';
import type { Metadata } from 'next';
import { RowActionForm } from '@/components/row-action-form';
import { cancelLessonAction } from '@/app/actions/admin-operations';
import { adminApi } from '@/lib/admin-api';
import { readAccessToken } from '@/lib/session';
import {
  dateKey,
  fromDateKey,
  lessonMoment,
  longDate,
  shiftDays,
  toDateKey,
  today,
} from '@/lib/studio-time';
import { BookLessonForm } from './book-lesson-form';

export const metadata: Metadata = {
  title: 'Розклад — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const LESSON_STATUS_LABELS: Record<string, string> = {
  PENDING: 'очікує підтвердження',
  CONFIRMED: 'підтверджено',
  COMPLETED: 'проведено',
  CANCELLED: 'скасовано',
  NO_SHOW: 'не прийшли',
};

const KIND_LABELS: Record<string, string> = {
  TRIAL: 'пробне',
  SINGLE: 'разове',
  SUBSCRIPTION: 'з абонемента',
  GROUP: 'групове',
};

/**
 * The whole studio's week, not one teacher's.
 *
 * The range lives in the address bar rather than in component state: a week
 * the studio is looking at is worth being able to send to a colleague, and a
 * page reached with no range at all is this week, which is what someone
 * opening the screen almost always means.
 */
export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; teacherId?: string }>;
}) {
  const params = await searchParams;
  const accessToken = (await readAccessToken()) ?? '';

  const from = params.from ?? dateKey(today());
  const to = params.to ?? dateKey(shiftDays(today(), 6));
  const teacherId = params.teacherId ?? '';

  const [lessons, teachers, students, locations, plans] = await Promise.all([
    adminApi
      .getSchedule({ from, to, ...(teacherId === '' ? {} : { teacherId }) }, accessToken)
      .catch(() => null),
    adminApi.getTeachers(accessToken).catch(() => []),
    adminApi.getStudents({}, accessToken).catch(() => []),
    adminApi.getLocations(accessToken).catch(() => []),
    adminApi.getPricePlans(accessToken).catch(() => []),
  ]);

  const days = groupByDay(lessons ?? []);

  return (
    <>
      <header className="admin-head">
        <p className="admin-eyebrow">Робота</p>
        <h1 className="admin-title">Розклад</h1>
        <p className="admin-lede">
          Усі заняття студії за обраний період — і індивідуальні, і зустрічі груп. Період
          зберігається в адресі сторінки, тож посилання можна переслати.
        </p>
      </header>

      <section className="admin-panel">
        <h2 className="admin-panel__title">Період</h2>

        {/* A plain GET form: the filter is the address, so the browser's own
            back button walks back through the weeks that were looked at. */}
        <form className="admin-form" method="get">
          <div className="admin-form__row">
            <p className="field">
              <label className="field-label" htmlFor="from">
                Від
              </label>
              <input id="from" name="from" type="date" className="field-input" defaultValue={from} />
            </p>
            <p className="field">
              <label className="field-label" htmlFor="to">
                До
              </label>
              <input id="to" name="to" type="date" className="field-input" defaultValue={to} />
            </p>
            <p className="field">
              <label className="field-label" htmlFor="teacherId">
                Викладач
              </label>
              <select
                id="teacherId"
                name="teacherId"
                className="field-input"
                defaultValue={teacherId}
              >
                <option value="">Усі</option>
                {teachers.map((teacher) => (
                  <option value={teacher.id} key={teacher.id}>
                    {teacher.lastName} {teacher.firstName}
                  </option>
                ))}
              </select>
            </p>
          </div>

          <div className="admin-row__actions">
            <button type="submit" className="admin-button admin-button--quiet">
              Показати
            </button>
          </div>
        </form>
      </section>

      {lessons === null ? (
        <p className="admin-note">Не вдалося прочитати розклад. Оновіть сторінку.</p>
      ) : days.length === 0 ? (
        <p className="admin-empty">За цей період занять немає.</p>
      ) : (
        days.map(([day, ofDay]) => (
          <section className="admin-panel" key={day}>
            <h2 className="admin-panel__title">{longDate(fromDateKey(day))}</h2>

            <ul className="admin-list">
              {ofDay.map((lesson) => (
                <li className="admin-row" key={lesson.id}>
                  <span className="admin-row__name">
                    {lessonMoment(new Date(lesson.startsAt))} ·{' '}
                    {lesson.group
                      ? lesson.group.name
                      : lesson.student
                        ? `${lesson.student.lastName} ${lesson.student.firstName}`
                        : 'Без учня'}
                  </span>
                  <span className="admin-row__meta">
                    {lesson.teacher.lastName} {lesson.teacher.firstName} · {lesson.location.name} ·{' '}
                    {lesson.durationMinutes} хв · {KIND_LABELS[lesson.kind] ?? lesson.kind}
                  </span>
                  {lesson.student ? (
                    <span className="admin-row__meta">{lesson.student.phone}</span>
                  ) : null}
                  <span className="admin-row__badges">
                    <span className="admin-badge" data-tone={toneOf(lesson.status)}>
                      {LESSON_STATUS_LABELS[lesson.status] ?? lesson.status}
                    </span>
                  </span>

                  {lesson.status === 'PENDING' || lesson.status === 'CONFIRMED' ? (
                    <RowActionForm
                      action={cancelLessonAction}
                      id={lesson.id}
                      label="Скасувати"
                      pendingLabel="Скасовуємо…"
                      tone="danger"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <section className="admin-panel">
        <h2 className="admin-panel__title">Записати учня</h2>
        <p className="admin-panel__lede">
          Для дзвінка до студії. Час перевіряється так само, як при записі із сайту: зайняту
          годину або час поза графіком викладача система не пропустить.
        </p>
        <BookLessonForm
          students={students}
          teachers={teachers}
          locations={locations}
          plans={plans}
        />
      </section>
    </>
  );
}

/**
 * The lessons of the range, split by the day they fall on in Kyiv - which is
 * what `toDateKey` decides, so an evening lesson lands on the day the studio
 * held it rather than on the day the server's clock was on.
 */
function groupByDay(lessons: Lesson[]): [string, Lesson[]][] {
  const days = new Map<string, Lesson[]>();

  for (const lesson of lessons) {
    const key = toDateKey(new Date(lesson.startsAt));
    const ofDay = days.get(key);
    if (ofDay) {
      ofDay.push(lesson);
    } else {
      days.set(key, [lesson]);
    }
  }

  return [...days.entries()];
}

function toneOf(status: string): string {
  if (status === 'PENDING') {
    return 'wait';
  }
  return status === 'CANCELLED' || status === 'NO_SHOW' ? 'gone' : 'draft';
}

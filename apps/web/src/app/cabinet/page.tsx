import type { Lesson } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FormAlert } from '@/components/form-alert';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { readAccessToken } from '@/lib/session';
import { LessonCard } from './lesson-card';
import { LogoutButton } from './logout-button';
import '../../styles/auth.css';
import '../../styles/booking.css';

export const metadata: Metadata = {
  title: 'Кабінет — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CabinetPage({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string; error?: string }>;
}) {
  const { booked, error } = await searchParams;
  const user = await getCurrentUser();

  // The middleware already turns anonymous visitors away; this is the second
  // lock, for the case where the cookie is present but the API rejects it.
  if (!user) {
    redirect('/login');
  }

  const lessons = await loadLessons();
  const now = new Date();
  const teaching = user.role === 'TEACHER' || user.role === 'ADMIN';

  const upcoming = lessons.filter(
    (lesson) =>
      new Date(lesson.startsAt) >= now &&
      (lesson.status === 'PENDING' || lesson.status === 'CONFIRMED'),
  );
  const toMark = teaching
    ? lessons.filter((lesson) => lesson.status === 'CONFIRMED' && new Date(lesson.startsAt) < now)
    : [];
  const history = lessons
    .filter((lesson) => !upcoming.includes(lesson) && !toMark.includes(lesson))
    .reverse();

  return (
    <main className="cabinet">
      <header className="cabinet-header">
        <div>
          <p className="auth-eyebrow">{teaching ? 'Кабінет викладача' : 'Кабінет учня'}</p>
          <h1 className="auth-title">
            Вітаємо, {user.firstName} {user.lastName}
          </h1>
        </div>
        <div className="cabinet-header-actions">
          {teaching ? (
            <Link href="/cabinet/schedule" className="button-quiet">
              Мій графік
            </Link>
          ) : (
            <Link href="/teachers" className="button-primary">
              Записатися на заняття
            </Link>
          )}
          <LogoutButton />
        </div>
      </header>

      {booked ? (
        <FormAlert tone="ok">Заявку надіслано. Викладач підтвердить її найближчим часом.</FormAlert>
      ) : null}
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}

      {user.emailVerifiedAt ? null : (
        <FormAlert tone="error">
          Пошту ще не підтверджено. Відкрийте лист, який ми надіслали при реєстрації — без цього
          другий запис буде недоступний.
        </FormAlert>
      )}

      {toMark.length > 0 ? (
        <section className="panel">
          <h2 className="panel-title">Потребують позначки</h2>
          <p className="panel-hint">
            Заняття вже відбулося — позначте, чи прийшов учень. Саме ця позначка списуватиме заняття
            з абонемента.
          </p>
          <div className="lesson-list">
            {toMark.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} user={user} now={now} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2 className="panel-title">Найближчі заняття</h2>
        {upcoming.length === 0 ? (
          <p className="empty">
            {teaching
              ? 'Записів поки немає.'
              : 'Записів поки немає. Оберіть викладача — перше заняття безкоштовне.'}
          </p>
        ) : (
          <div className="lesson-list">
            {upcoming.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} user={user} now={now} />
            ))}
          </div>
        )}
      </section>

      {history.length > 0 ? (
        <section className="panel">
          <h2 className="panel-title">Історія</h2>
          <div className="lesson-list">
            {history.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} user={user} now={now} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="cabinet-card">
        <h2 className="auth-title">Мої дані</h2>
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

async function loadLessons(): Promise<Lesson[]> {
  const accessToken = await readAccessToken();
  if (!accessToken) {
    return [];
  }

  try {
    return await api.getMyLessons(accessToken);
  } catch {
    // An empty list rather than a broken page: the rest of the cabinet still
    // tells the visitor who they are and how to reach the studio.
    return [];
  }
}

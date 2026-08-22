import type { PublicTeacher } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ViewTransition } from 'react';
import { api } from '@/lib/api';
import '@/styles/booking.css';

export const metadata: Metadata = {
  title: 'Викладачі — Палітра талантів',
  description: 'Викладачі вокалу, фортепіано, гітари та укулеле студії «Палітра талантів».',
  alternates: { canonical: '/teachers' },
};

export const dynamic = 'force-dynamic';

export default async function TeachersPage() {
  let teachers: PublicTeacher[] = [];
  let failed = false;

  try {
    teachers = await api.getTeachers();
  } catch {
    failed = true;
  }

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Палітра талантів</p>
        <h1 className="page-title">Викладачі</h1>
        <p className="page-lede">
          Оберіть викладача, щоб побачити вільний час і записатися. Перше заняття — безкоштовне.
        </p>
      </header>

      {failed ? (
        <p className="empty">Не вдалося завантажити список. Спробуйте оновити сторінку.</p>
      ) : null}

      {!failed && teachers.length === 0 ? (
        <p className="empty">Список викладачів ще наповнюється.</p>
      ) : null}

      <ul className="teacher-grid">
        {teachers.map((teacher) => (
          <li key={teacher.id}>
            <Link href={`/teachers/${teacher.id}`} className="teacher-card">
              {/* A portrait where the studio has sent one, and the person's
                  initials set in the display face where it has not.

                  Stage 5 refused a placeholder here, and was right about what
                  it refused: a grey box is the absence of an answer, and in
                  every other card it reads as a broken site. Type is not that.
                  It is the same letters the mark is drawn in, it is different
                  for every teacher, and a page of them holds together while
                  the photographs arrive one at a time. */}
              {teacher.photoUrl === null ? (
                <span className="teacher-initials" aria-hidden="true">
                  {initials(teacher.firstName, teacher.lastName)}
                </span>
              ) : (
                <ViewTransition name={`teacher-photo-${teacher.id}`}>
                  <img className="teacher-photo" src={teacher.photoUrl} alt="" loading="lazy" />
                </ViewTransition>
              )}

              <ViewTransition name={`teacher-name-${teacher.id}`}>
                <span className="teacher-name">
                  {teacher.firstName} {teacher.lastName}
                </span>
              </ViewTransition>

              <span className="chip-row">
                {teacher.directions.map((direction) => (
                  <span key={direction.id} className="chip">
                    {direction.name}
                  </span>
                ))}
              </span>

              {teacher.bio ? <span className="teacher-bio">{teacher.bio}</span> : null}

              <span className="teacher-meta">
                {teacher.experienceYears === null
                  ? null
                  : `Досвід ${teacher.experienceYears} р. · `}
                {teacher.locations.map((location) => location.name).join(', ')}
              </span>

              <span className="teacher-cta">Вільний час →</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

/**
 * Two letters, hidden from screen readers: the name is right underneath in
 * full, and having it read out twice helps nobody.
 */
function initials(firstName: string, lastName: string): string {
  return `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase();
}

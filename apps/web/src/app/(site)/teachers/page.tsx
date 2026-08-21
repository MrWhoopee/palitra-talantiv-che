import type { PublicTeacher } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
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
              {/* Only where there is one. A card without a photo keeps the
                  shape it has always had rather than growing a grey box: the
                  studio is sending pictures one at a time, and a placeholder
                  in every other card would look like the site is broken. */}
              {teacher.photoUrl === null ? null : (
                <img className="teacher-photo" src={teacher.photoUrl} alt="" loading="lazy" />
              )}

              <span className="teacher-name">
                {teacher.firstName} {teacher.lastName}
              </span>

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

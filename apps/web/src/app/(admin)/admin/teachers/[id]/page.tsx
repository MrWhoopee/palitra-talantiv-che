import type { Direction, Location } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { adminApi } from '@/lib/admin-api';
import { readAccessToken } from '@/lib/session';
import { LinksForm } from './links-form';
import { ReinviteForm } from './reinvite-form';
import { TeacherForm } from './teacher-form';

export const metadata: Metadata = {
  title: 'Викладач — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminTeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accessToken = (await readAccessToken()) ?? '';

  const teacher = await adminApi.getTeacher(id, accessToken).catch(() => null);
  if (!teacher) {
    notFound();
  }

  // The pickers read the public lists: these tables have no drafts, so what
  // the studio can choose from is the same thing the site shows.
  const [directions, locations] = await Promise.all([
    load<Direction>(() => api.getDirections()),
    load<Location>(() => api.getLocations()),
  ]);

  return (
    <>
      <p className="admin-back">
        <Link href="/admin/teachers">← Викладачі</Link>
      </p>

      <header className="admin-head">
        <p className="admin-eyebrow">Студія</p>
        <h1 className="admin-title">
          {teacher.lastName} {teacher.firstName}
        </h1>
        <p className="admin-lede">
          {teacher.email} · {teacher.phone}
        </p>
      </header>

      {teacher.hasPassword ? null : (
        <section className="admin-panel">
          <h2 className="admin-panel__title">Запрошення</h2>
          <p className="admin-panel__lede">
            Викладач ще не відкрив посилання з листа, тож увійти в кабінет поки не може. Картку
            можна заповнювати вже зараз — вона від цього не залежить.
          </p>
          <ReinviteForm teacherId={teacher.id} />
        </section>
      )}

      <section className="admin-panel">
        <h2 className="admin-panel__title">Картка</h2>
        <TeacherForm teacher={teacher} />
      </section>

      <section className="admin-panel">
        <h2 className="admin-panel__title">Напрями</h2>
        <p className="admin-panel__lede">Те, що викладач веде. Показується на його картці на сайті.</p>
        <LinksForm
          teacherId={teacher.id}
          kind="directions"
          options={directions.map((direction) => ({ id: direction.id, label: direction.name }))}
          checked={teacher.directions.map((direction) => direction.id)}
        />
      </section>

      <section className="admin-panel">
        <h2 className="admin-panel__title">Локації</h2>
        <p className="admin-panel__lede">
          Адреси, за якими викладач працює. Із них складається розклад і вибір при записі.
        </p>
        <LinksForm
          teacherId={teacher.id}
          kind="locations"
          options={locations.map((location) => ({ id: location.id, label: location.name }))}
          checked={teacher.locations.map((location) => location.id)}
        />
      </section>
    </>
  );
}

/** A failed list leaves the rest of the card usable rather than blanking it. */
async function load<T>(request: () => Promise<T[]>): Promise<T[]> {
  try {
    return await request();
  } catch {
    return [];
  }
}

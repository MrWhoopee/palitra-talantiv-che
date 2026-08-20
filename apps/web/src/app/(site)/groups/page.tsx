import type { Group } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import { describeGroupSchedule } from '@/lib/studio-time';
import '@/styles/booking.css';

export const metadata: Metadata = {
  title: 'Групи — Палітра талантів',
  description: 'Ансамблі та групові заняття студії «Палітра талантів» у Черкасах.',
  alternates: { canonical: '/groups' },
};

export const dynamic = 'force-dynamic';

export default async function GroupsPage() {
  const groups = await loadGroups();

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Групи</p>
        <h1 className="page-title">Ансамблі й групові заняття</h1>
        <p className="page-lede">
          У групі займаються за постійним розкладом. Подайте заявку — викладач підтвердить її й
          заняття зʼявляться у вашому кабінеті.
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="empty">Наразі відкритого набору немає. Зазирніть за тиждень.</p>
      ) : (
        <ul className="teacher-grid">
          {groups.map((group) => (
            <li key={group.id}>
              <Link href={`/groups/${group.id}`} className="teacher-card">
                <span className="teacher-name">{group.name}</span>
                <span className="chip-row">
                  <span className="chip">{group.direction.name}</span>
                  <span className="chip">{group.durationMinutes} хв</span>
                </span>
                <span className="teacher-meta">
                  {describeGroupSchedule(group.schedule)} · {group.location.name}
                </span>
                <span className="teacher-meta">
                  Викладач: {group.teacher.firstName} {group.teacher.lastName}
                </span>
                <span className={group.seatsLeft > 0 ? 'badge badge-ok' : 'badge badge-off'}>
                  {group.seatsLeft > 0 ? `Вільних місць: ${group.seatsLeft}` : 'Місць немає'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

async function loadGroups(): Promise<Group[]> {
  try {
    return await api.getGroups();
  } catch {
    // An empty list rather than a broken page - the same choice the teacher
    // list makes when the API is down.
    return [];
  }
}

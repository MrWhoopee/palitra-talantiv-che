import type { Direction, Group, Location } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { readAccessToken } from '@/lib/session';
import { dateKey, describeGroupSchedule, today } from '@/lib/studio-time';
import { GroupForm } from './group-form';
import '@/styles/auth.css';
import '@/styles/booking.css';

export const metadata: Metadata = {
  title: 'Мої групи — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CabinetGroupsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'TEACHER' && user.role !== 'ADMIN') {
    return (
      <main className="cabinet">
        <p className="auth-eyebrow">
          <Link href="/cabinet">← Кабінет</Link>
        </p>
        <h1 className="auth-title">Групи</h1>
        <p className="empty">
          Ця сторінка призначена для викладачів. Записатися до групи можна{' '}
          <Link href="/groups">у переліку груп</Link>.
        </p>
      </main>
    );
  }

  const accessToken = (await readAccessToken()) ?? '';
  const [groups, locations, directions] = await Promise.all([
    load<Group>(() => api.getMyGroups(accessToken)),
    load<Location>(() => api.getLocations()),
    load<Direction>(() => api.getDirections()),
  ]);

  return (
    <main className="cabinet">
      <p className="auth-eyebrow">
        <Link href="/cabinet">← Кабінет</Link>
      </p>

      <header className="cabinet-header">
        <div>
          <h1 className="auth-title">Мої групи</h1>
          <p className="page-lede">
            Розклад групи одразу перетворюється на заняття в календарі — вони займають ваш час так
            само, як індивідуальні.
          </p>
        </div>
      </header>

      <section className="panel">
        <h2 className="panel-title">Групи</h2>

        {groups.length === 0 ? (
          <p className="empty">Груп ще немає.</p>
        ) : (
          <ul className="rule-list">
            {groups.map((group) => (
              <li key={group.id} className="rule">
                <span className="rule-when">
                  <strong>{group.name}</strong> {describeGroupSchedule(group.schedule)}
                </span>
                <span className="rule-where">
                  {group.direction.name} · {group.location.name}
                </span>
                <span className="rule-valid">
                  {group.seatsTaken} з {group.capacity} місць
                  {group.isOpenForEnrollment ? '' : ' · набір закрито'}
                </span>
                <Link href={`/cabinet/groups/${group.id}`} className="button-quiet">
                  Склад і заявки
                </Link>
              </li>
            ))}
          </ul>
        )}

        <h3 className="panel-subtitle">Створити групу</h3>
        <GroupForm locations={locations} directions={directions} today={dateKey(today())} />
      </section>
    </main>
  );
}

/** A failed list leaves the rest of the screen usable rather than blanking it. */
async function load<T>(request: () => Promise<T[]>): Promise<T[]> {
  try {
    return await request();
  } catch {
    return [];
  }
}

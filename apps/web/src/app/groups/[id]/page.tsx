import type { Group } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { readAccessToken } from '@/lib/session';
import { describeGroupSchedule, fromDateKey, longDate } from '@/lib/studio-time';
import { ApplyForm } from './apply-form';
import '../../../styles/booking.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const group = await loadGroup(id);

  if (!group) {
    return { title: 'Групу не знайдено — Палітра талантів' };
  }

  return {
    title: `${group.name} — Палітра талантів`,
    description: `${group.direction.name}, ${describeGroupSchedule(group.schedule)}, ${group.location.name}.`,
  };
}

export const dynamic = 'force-dynamic';

export default async function GroupPage({ params }: PageProps) {
  const { id } = await params;
  const group = await loadGroup(id);

  if (!group) {
    notFound();
  }

  const user = await getCurrentUser();
  const membership = user ? await membershipOf(group.id) : 'none';

  return (
    <main className="page">
      <p className="eyebrow">
        <Link href="/groups">← Усі групи</Link>
      </p>

      <header className="page-head">
        <h1 className="page-title">{group.name}</h1>
        <p className="chip-row">
          <span className="chip">{group.direction.name}</span>
          <span className="chip">{group.durationMinutes} хв</span>
        </p>
        <p className="teacher-meta">
          {group.location.name} — {group.location.address}
        </p>
        <p className="teacher-meta">
          Викладач: {group.teacher.firstName} {group.teacher.lastName}
        </p>
      </header>

      <section className="panel">
        <h2 className="panel-title">Розклад</h2>
        <p className="panel-hint">Час київський.</p>
        <p className="lesson-line">{describeGroupSchedule(group.schedule)}</p>
        <p className="lesson-line lesson-place">
          Заняття з {longDate(fromDateKey(group.startsOn))}
          {group.endsOn ? ` до ${longDate(fromDateKey(group.endsOn))}` : ' і далі щотижня'}
        </p>
        <p className="lesson-line">
          <span className={group.seatsLeft > 0 ? 'badge badge-ok' : 'badge badge-off'}>
            {group.seatsLeft > 0
              ? `Вільних місць: ${group.seatsLeft} з ${group.capacity}`
              : 'Місць немає'}
          </span>
        </p>
      </section>

      <section className="panel">
        <h2 className="panel-title">Заявка</h2>

        {user === null ? (
          <p className="panel-note">
            Щоб подати заявку, потрібен кабінет.{' '}
            <Link href={`/login?next=${encodeURIComponent(`/groups/${group.id}`)}`}>Увійти</Link>{' '}
            або{' '}
            <Link href={`/register?next=${encodeURIComponent(`/groups/${group.id}`)}`}>
              зареєструватися
            </Link>
            .
          </p>
        ) : membership === 'ACTIVE' ? (
          <p className="panel-note">Ви вже займаєтеся в цій групі — розклад у кабінеті.</p>
        ) : membership === 'PENDING' ? (
          <p className="panel-note">Заявку подано. Викладач розгляне її найближчим часом.</p>
        ) : (
          <ApplyForm
            groupId={group.id}
            disabled={!group.isOpenForEnrollment || group.seatsLeft <= 0}
          />
        )}
      </section>
    </main>
  );
}

async function loadGroup(id: string): Promise<Group | null> {
  try {
    return await api.getGroup(id);
  } catch {
    return null;
  }
}

/**
 * Whether the visitor is already in this group.
 *
 * Membership shows up in two places: `/me/groups` lists the groups they have
 * a live application to, and `/me/lessons` gains the group's meetings only
 * once that application is approved. The pair tells "applied" from "in the
 * group" without a third endpoint, and the API decides for real either way -
 * this only keeps the screen from offering a button that would be refused.
 */
async function membershipOf(groupId: string): Promise<'ACTIVE' | 'PENDING' | 'none'> {
  const accessToken = await readAccessToken();
  if (!accessToken) {
    return 'none';
  }

  try {
    const [mine, lessons] = await Promise.all([
      api.getMyGroups(accessToken),
      api.getMyLessons(accessToken),
    ]);

    if (lessons.some((lesson) => lesson.group?.id === groupId)) {
      return 'ACTIVE';
    }
    return mine.some((group) => group.id === groupId) ? 'PENDING' : 'none';
  } catch {
    return 'none';
  }
}

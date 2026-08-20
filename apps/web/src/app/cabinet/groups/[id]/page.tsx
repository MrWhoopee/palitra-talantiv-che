import type { Group, GroupEnrollment, Lesson } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { approveEnrollmentAction, removeEnrollmentAction } from '@/app/actions/groups';
import { FormAlert } from '@/components/form-alert';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { readAccessToken } from '@/lib/session';
import { describeGroupSchedule, lessonMoment } from '@/lib/studio-time';
import '../../../../styles/auth.css';
import '../../../../styles/booking.css';

export const metadata: Metadata = {
  title: 'Група — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function CabinetGroupPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { error } = await searchParams;

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const accessToken = (await readAccessToken()) ?? '';
  const group = await loadGroup(id);
  if (!group) {
    notFound();
  }

  // The API refuses a colleague's roster; the screen says so plainly rather
  // than showing an empty group.
  const enrollments = await loadEnrollments(id, accessToken);
  if (enrollments === null) {
    return (
      <main className="cabinet">
        <p className="auth-eyebrow">
          <Link href="/cabinet/groups">← Мої групи</Link>
        </p>
        <h1 className="auth-title">{group.name}</h1>
        <p className="empty">Склад цієї групи веде інший викладач.</p>
      </main>
    );
  }

  const pending = enrollments.filter((enrollment) => enrollment.status === 'PENDING');
  const members = enrollments.filter((enrollment) => enrollment.status === 'ACTIVE');
  const meetings = await loadMeetings(id, accessToken);
  const now = new Date();

  return (
    <main className="cabinet">
      <p className="auth-eyebrow">
        <Link href="/cabinet/groups">← Мої групи</Link>
      </p>

      <header className="cabinet-header">
        <div>
          <h1 className="auth-title">{group.name}</h1>
          <p className="page-lede">
            {describeGroupSchedule(group.schedule)} · {group.location.name} ·{' '}
            {group.durationMinutes} хв
          </p>
        </div>
      </header>

      {error ? <FormAlert tone="error">{error}</FormAlert> : null}

      <section className="panel">
        <h2 className="panel-title">Заявки</h2>
        <p className="panel-hint">
          Місце тримається від моменту заявки — {group.seatsTaken} з {group.capacity} зайнято.
        </p>

        {pending.length === 0 ? (
          <p className="empty">Нових заявок немає.</p>
        ) : (
          <ul className="rule-list">
            {pending.map((enrollment) => (
              <li key={enrollment.id} className="rule">
                <span className="rule-when">
                  <strong>{fullName(enrollment)}</strong>
                </span>
                <span className="rule-where">
                  <a href={`tel:${enrollment.student.phone}`}>{enrollment.student.phone}</a>
                </span>
                <RosterButton
                  action={approveEnrollmentAction}
                  groupId={group.id}
                  enrollmentId={enrollment.id}
                  tone="primary"
                >
                  Прийняти
                </RosterButton>
                <RosterButton
                  action={removeEnrollmentAction}
                  groupId={group.id}
                  enrollmentId={enrollment.id}
                >
                  Відхилити
                </RosterButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">Склад</h2>

        {members.length === 0 ? (
          <p className="empty">У групі поки нікого немає.</p>
        ) : (
          <ul className="rule-list">
            {members.map((enrollment) => (
              <li key={enrollment.id} className="rule">
                <span className="rule-when">
                  <strong>{fullName(enrollment)}</strong>
                </span>
                <span className="rule-where">
                  <a href={`tel:${enrollment.student.phone}`}>{enrollment.student.phone}</a>
                </span>
                <RosterButton
                  action={removeEnrollmentAction}
                  groupId={group.id}
                  enrollmentId={enrollment.id}
                >
                  Виключити
                </RosterButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">Заняття</h2>
        <p className="panel-hint">Журнал відкривається для кожного заняття окремо.</p>

        {meetings.length === 0 ? (
          <p className="empty">Занять ще немає.</p>
        ) : (
          <ul className="rule-list">
            {meetings.map((lesson) => (
              <li key={lesson.id} className="rule">
                <span className="rule-when">
                  <strong>{lessonMoment(new Date(lesson.startsAt))}</strong>
                </span>
                <span className="rule-where">
                  {new Date(lesson.startsAt) <= now ? 'відбулося' : 'попереду'}
                </span>
                <Link href={`/cabinet/lessons/${lesson.id}/attendance`} className="button-quiet">
                  Журнал
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function fullName(enrollment: GroupEnrollment): string {
  return `${enrollment.student.lastName} ${enrollment.student.firstName}`;
}

async function loadGroup(id: string): Promise<Group | null> {
  try {
    return await api.getGroup(id);
  } catch {
    return null;
  }
}

/** `null` means "not this teacher's group", which is not the same as "empty". */
async function loadEnrollments(
  id: string,
  accessToken: string,
): Promise<GroupEnrollment[] | null> {
  try {
    return await api.getGroupEnrollments(id, accessToken);
  } catch {
    return null;
  }
}

async function loadMeetings(groupId: string, accessToken: string): Promise<Lesson[]> {
  try {
    const lessons = await api.getMyLessons(accessToken);
    return lessons.filter((lesson) => lesson.group?.id === groupId);
  } catch {
    return [];
  }
}

/**
 * A form rather than a link: admitting somebody to a group changes state, so
 * it must not be reachable by a prefetch.
 */
function RosterButton({
  action,
  groupId,
  enrollmentId,
  tone,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  groupId: string;
  enrollmentId: string;
  tone?: 'primary';
  children: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <button type="submit" className={tone === 'primary' ? 'button-primary' : 'button-quiet'}>
        {children}
      </button>
    </form>
  );
}

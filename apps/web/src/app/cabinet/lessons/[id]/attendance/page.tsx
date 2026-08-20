import type { LessonAttendance } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { readAccessToken } from '@/lib/session';
import { lessonMoment } from '@/lib/studio-time';
import { RegisterForm } from './register-form';
import '../../../../../styles/auth.css';
import '../../../../../styles/booking.css';

export const metadata: Metadata = {
  title: 'Журнал — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const accessToken = (await readAccessToken()) ?? '';
  const register = await loadRegister(id, accessToken);
  if (!register) {
    notFound();
  }

  return (
    <main className="cabinet">
      <p className="auth-eyebrow">
        <Link href={`/cabinet/groups/${register.groupId}`}>← {register.groupName}</Link>
      </p>

      <header className="cabinet-header">
        <div>
          <h1 className="auth-title">Журнал</h1>
          <p className="page-lede">{lessonMoment(new Date(register.startsAt))}</p>
        </div>
      </header>

      <section className="panel">
        {register.entries.length === 0 ? (
          <p className="empty">У групі поки нікого немає — приймайте заявки.</p>
        ) : (
          <RegisterForm lessonId={register.lessonId} entries={register.entries} />
        )}
      </section>
    </main>
  );
}

/**
 * A register the caller may not keep comes back as a 403, and the screen shows
 * the same thing it shows for a lesson that does not exist: a teacher probing
 * ids learns nothing either way.
 */
async function loadRegister(
  lessonId: string,
  accessToken: string,
): Promise<LessonAttendance | null> {
  try {
    return await api.getAttendance(lessonId, accessToken);
  } catch {
    return null;
  }
}

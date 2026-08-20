import type { AvailabilityException, AvailabilityRule, Location } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { deleteExceptionAction, deleteRuleAction } from '@/app/actions/availability';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { readAccessToken } from '@/lib/session';
import { dateKey, lessonMoment, today, WEEKDAY_LABELS } from '@/lib/studio-time';
import { ExceptionForm } from './exception-form';
import { RuleForm } from './rule-form';
import '@/styles/auth.css';
import '@/styles/booking.css';

export const metadata: Metadata = {
  title: 'Мій графік — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const KIND_LABELS: Record<AvailabilityException['kind'], string> = {
  VACATION: 'Відпустка',
  SICK: 'Хвороба',
  BLOCKED: 'Зайнято',
};

export default async function SchedulePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const accessToken = await readAccessToken();
  const todayKey = dateKey(today());

  if (user.role !== 'TEACHER') {
    // An admin edits somebody else's timetable through the same endpoints, but
    // the screen for picking whose arrives with the admin panel in stage 6.
    return (
      <main className="cabinet">
        <p className="auth-eyebrow">
          <Link href="/cabinet">← Кабінет</Link>
        </p>
        <h1 className="auth-title">Графік</h1>
        <p className="empty">Ця сторінка призначена для викладачів.</p>
      </main>
    );
  }

  const [rules, exceptions, locations] = await Promise.all([
    load(() => api.getAvailabilityRules(user.id, accessToken ?? '')),
    load(() => api.getAvailabilityExceptions(user.id, accessToken ?? '')),
    load(() => api.getLocations()),
  ]);

  return (
    <main className="cabinet">
      <p className="auth-eyebrow">
        <Link href="/cabinet">← Кабінет</Link>
      </p>

      <header className="cabinet-header">
        <div>
          <h1 className="auth-title">Мій графік</h1>
          <p className="page-lede">
            Правила описують звичайний тиждень, відсутності вирізають з нього окремі дні. Учні
            бачать лише те, що лишилося вільним.
          </p>
        </div>
      </header>

      <section className="panel">
        <h2 className="panel-title">Робочі правила</h2>

        {rules.length === 0 ? (
          <p className="empty">Правил ще немає — поки що жоден учень не побачить вільного часу.</p>
        ) : (
          <ul className="rule-list">
            {rules.map((rule: AvailabilityRule) => (
              <li key={rule.id} className="rule">
                <span className="rule-when">
                  <strong>{WEEKDAY_LABELS[rule.weekday]}</strong> {rule.startTime}–{rule.endTime}
                </span>
                <span className="rule-where">{nameOf(locations, rule.locationId)}</span>
                <span className="rule-valid">
                  з {rule.validFrom}
                  {rule.validTo ? ` до ${rule.validTo}` : ''}
                </span>
                <form action={deleteRuleAction}>
                  <input type="hidden" name="teacherId" value={user.id} />
                  <input type="hidden" name="ruleId" value={rule.id} />
                  <button type="submit" className="button-quiet">
                    Видалити
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <h3 className="panel-subtitle">Додати правило</h3>
        <RuleForm teacherId={user.id} locations={locations} today={todayKey} />
      </section>

      <section className="panel">
        <h2 className="panel-title">Відсутності</h2>

        {exceptions.length === 0 ? (
          <p className="empty">Відпусток і вихідних не заплановано.</p>
        ) : (
          <ul className="rule-list">
            {exceptions.map((exception: AvailabilityException) => (
              <li key={exception.id} className="rule">
                <span className="rule-when">
                  <strong>{KIND_LABELS[exception.kind]}</strong>{' '}
                  {lessonMoment(new Date(exception.startsAt))} —{' '}
                  {lessonMoment(new Date(exception.endsAt))}
                </span>
                <span className="rule-where">{exception.note ?? ''}</span>
                <form action={deleteExceptionAction}>
                  <input type="hidden" name="teacherId" value={user.id} />
                  <input type="hidden" name="exceptionId" value={exception.id} />
                  <button type="submit" className="button-quiet">
                    Видалити
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <h3 className="panel-subtitle">Додати відсутність</h3>
        <ExceptionForm teacherId={user.id} today={todayKey} />
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

function nameOf(locations: readonly Location[], locationId: string): string {
  return locations.find((location) => location.id === locationId)?.name ?? '—';
}

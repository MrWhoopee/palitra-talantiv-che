import type { Lesson, PricePlan, PublicTeacher, Slot, Subscription } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { readAccessToken } from '@/lib/session';
import { dateKey, longDate, shiftDays, timeOf, today, toDateKey } from '@/lib/studio-time';
import { BookingForm } from './booking-form';
import '@/styles/booking.css';

/** The calendar shows one week at a time, up to the four-week booking horizon. */
const WEEKS_AHEAD = 4;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string; week?: string }>;
}

/**
 * What pays for a lesson, as one list: the tariffs the studio sells and the
 * packages this visitor already holds with this teacher. They are the same
 * choice from the calendar's point of view - both fix a duration - so the
 * screen offers them side by side instead of splitting into two flows.
 */
interface BookingSource {
  key: string;
  title: string;
  detail: string;
  durationMinutes: number;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const teacher = await loadTeacher(id);

  if (!teacher) {
    return { title: 'Викладача не знайдено — Палітра талантів' };
  }

  return {
    title: `${teacher.firstName} ${teacher.lastName} — Палітра талантів`,
    description: teacher.bio ?? 'Запис на заняття у студії «Палітра талантів».',
    alternates: { canonical: `/teachers/${teacher.id}` },
  };
}

export const dynamic = 'force-dynamic';

export default async function TeacherPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { source: sourceKey, week } = await searchParams;

  const teacher = await loadTeacher(id);
  if (!teacher) {
    notFound();
  }

  const user = await getCurrentUser();
  const [plans, packages] = await Promise.all([
    loadPlansFor(teacher),
    user ? loadPackagesFor(teacher.id) : Promise.resolve([]),
  ]);

  const sources = [...packages.map(toPackageSource), ...plans.map(toPlanSource)];
  const source = sources.find((candidate) => candidate.key === sourceKey) ?? sources[0];

  const weekOffset = clampWeek(week);
  const from = shiftDays(today(), weekOffset * 7);
  const to = shiftDays(from, 6);

  const slots = source
    ? await loadSlots(teacher.id, dateKey(from), dateKey(to), source.durationMinutes)
    : [];

  const byDay = groupByDay(slots);
  const days = Array.from({ length: 7 }, (_, offset) => shiftDays(from, offset));
  const trialAvailable = await hasTrialLeft(user?.id ?? null);

  return (
    <main className="page">
      <p className="eyebrow">
        <Link href="/teachers">← Усі викладачі</Link>
      </p>

      <header className="page-head">
        <h1 className="page-title">
          {teacher.firstName} {teacher.lastName}
        </h1>
        <p className="chip-row">
          {teacher.directions.map((direction) => (
            <span key={direction.id} className="chip">
              {direction.name}
            </span>
          ))}
        </p>
        {teacher.bio ? <p className="page-lede">{teacher.bio}</p> : null}
        <p className="teacher-meta">
          {teacher.locations
            .map((location) => `${location.name} — ${location.address}`)
            .join(' · ')}
        </p>
      </header>

      {sources.length === 0 ? (
        <p className="empty">
          Для цього викладача ще не налаштовані тарифи. Зателефонуйте студії, щоб записатися.
        </p>
      ) : (
        <>
          <section className="panel">
            <h2 className="panel-title">1. Оберіть тариф</h2>
            <p className="panel-hint">Тариф задає тривалість заняття.</p>

            <ul className="chip-row">
              {sources.map((candidate) => (
                <li key={candidate.key}>
                  <Link
                    href={`/teachers/${teacher.id}?source=${encodeURIComponent(candidate.key)}&week=${weekOffset}`}
                    className={`plan-chip${candidate.key === source?.key ? ' plan-chip-active' : ''}`}
                    aria-current={candidate.key === source?.key ? 'true' : undefined}
                  >
                    <strong>{candidate.title}</strong>
                    <span>{candidate.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">2. Оберіть час</h2>
                <p className="panel-hint">
                  Час київський. Записатися можна на чотири тижні вперед.
                </p>
              </div>

              <nav className="week-nav" aria-label="Тиждень">
                {Array.from({ length: WEEKS_AHEAD }, (_, index) => (
                  <Link
                    key={index}
                    href={`/teachers/${teacher.id}?source=${encodeURIComponent(source?.key ?? '')}&week=${index}`}
                    className={`week-link${index === weekOffset ? ' week-link-active' : ''}`}
                    aria-current={index === weekOffset ? 'page' : undefined}
                  >
                    {index === 0 ? 'Цей тиждень' : `+${index} тижд.`}
                  </Link>
                ))}
              </nav>
            </div>

            {user === null ? (
              <p className="panel-note">
                Щоб записатися, потрібен кабінет.{' '}
                <Link href={`/login?next=${encodeURIComponent(`/teachers/${teacher.id}`)}`}>
                  Увійти
                </Link>{' '}
                або{' '}
                <Link href={`/register?next=${encodeURIComponent(`/teachers/${teacher.id}`)}`}>
                  зареєструватися
                </Link>
                .
              </p>
            ) : null}

            {source ? (
              <BookingForm
                teacherId={teacher.id}
                source={source.key}
                signedIn={user !== null}
                trialAvailable={trialAvailable}
                fromSubscription={source.key.startsWith('subscription:')}
                days={days.map((day) => ({
                  key: dateKey(day),
                  label: longDate(day),
                  slots: (byDay.get(dateKey(day)) ?? []).map((slot) => ({
                    value: `${slot.startsAt}|${slot.locationId}`,
                    label: timeOf(new Date(slot.startsAt)),
                    locationName:
                      teacher.locations.find((location) => location.id === slot.locationId)?.name ??
                      '',
                  })),
                }))}
                showLocations={teacher.locations.length > 1}
              />
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}

async function loadTeacher(id: string): Promise<PublicTeacher | null> {
  try {
    return await api.getTeacher(id);
  } catch {
    return null;
  }
}

/**
 * The tariffs of the directions this teacher actually teaches, and only the
 * single-lesson ones: a package is bought and then drawn from, which is what
 * `Subscription` does in stage 4. Offering one here would put an eight-lesson
 * price on a single booking.
 */
async function loadPlansFor(teacher: PublicTeacher): Promise<PricePlan[]> {
  const directionIds = new Set(teacher.directions.map((direction) => direction.id));

  try {
    const plans = await api.getPricePlans();
    return plans.filter(
      (plan) =>
        plan.format === 'INDIVIDUAL' &&
        plan.lessonsCount === 1 &&
        directionIds.has(plan.directionId),
    );
  } catch {
    return [];
  }
}

/**
 * The packages this visitor may still draw a lesson from with this teacher.
 * The API refuses an exhausted or expired one anyway; filtering here keeps the
 * screen from offering a choice it knows would be refused.
 */
async function loadPackagesFor(teacherId: string): Promise<Subscription[]> {
  const accessToken = await readAccessToken();
  if (!accessToken) {
    return [];
  }

  const todayKey = dateKey(today());

  try {
    const subscriptions = await api.getMySubscriptions(accessToken);
    return subscriptions.filter(
      (subscription) =>
        subscription.teacher.id === teacherId &&
        subscription.status === 'ACTIVE' &&
        subscription.lessonsLeft > 0 &&
        subscription.validFrom <= todayKey &&
        subscription.validTo >= todayKey,
    );
  } catch {
    return [];
  }
}

function toPlanSource(plan: PricePlan): BookingSource {
  return {
    key: `plan:${plan.id}`,
    title: plan.directionName,
    detail: `${plan.name} · ${plan.durationMinutes} хв · ${plan.priceUah} ₴`,
    durationMinutes: plan.durationMinutes,
  };
}

function toPackageSource(subscription: Subscription): BookingSource {
  return {
    key: `subscription:${subscription.id}`,
    title: subscription.directionName ?? 'Абонемент',
    detail: `Абонемент · лишилось ${subscription.lessonsLeft} з ${subscription.lessonsTotal}`,
    // The package carries the length of the plan it was sold against, which
    // is the same length the API will use when the booking arrives.
    durationMinutes: subscription.durationMinutes,
  };
}

async function loadSlots(
  teacherId: string,
  from: string,
  to: string,
  duration: number,
): Promise<Slot[]> {
  try {
    return (await api.getSlots(teacherId, { from, to, duration })).slots;
  } catch {
    return [];
  }
}

/**
 * The trial is one per student for good, so the form only offers it when the
 * visitor still has it. The API decides for real; this keeps the screen from
 * showing a choice that would be refused.
 *
 * `/me/lessons` answers with every lesson the person is a party to, so the
 * ones they *teach* have to be filtered out - otherwise a teacher looking at
 * a colleague's page would be told they had used up a trial they never took.
 */
async function hasTrialLeft(userId: string | null): Promise<boolean> {
  if (!userId) {
    return true;
  }

  const accessToken = await readAccessToken();
  if (!accessToken) {
    return true;
  }

  try {
    const lessons: Lesson[] = await api.getMyLessons(accessToken);
    return !lessons.some(
      (lesson) =>
        lesson.student?.id === userId && lesson.kind === 'TRIAL' && lesson.status !== 'CANCELLED',
    );
  } catch {
    return true;
  }
}

function groupByDay(slots: readonly Slot[]): Map<string, Slot[]> {
  const grouped = new Map<string, Slot[]>();

  for (const slot of slots) {
    const key = toDateKey(new Date(slot.startsAt));
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(slot);
    } else {
      grouped.set(key, [slot]);
    }
  }

  return grouped;
}

function clampWeek(value: string | undefined): number {
  const week = Number(value ?? 0);
  if (!Number.isInteger(week) || week < 0) {
    return 0;
  }
  return Math.min(week, WEEKS_AHEAD - 1);
}

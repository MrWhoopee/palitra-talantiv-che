'use server';

import { attendanceUpdateSchema, groupInputSchema, type AttendanceStatus } from '@palitra/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { flattenError } from 'zod';
import { api } from '@/lib/api';
import { describeError, fieldErrorsOf } from '@/lib/error-messages';
import type { FormState } from '@/lib/form-state';
import { readAccessToken } from '@/lib/session';

/**
 * How many meetings a week the form offers. Three covers every course the
 * studio runs today and keeps the form usable with JavaScript switched off -
 * an "add another" button would need scripting to mean anything.
 */
const MEETING_SLOTS = 3;

async function requireToken(): Promise<string> {
  const accessToken = await readAccessToken();
  if (!accessToken) {
    redirect('/login');
  }
  return accessToken;
}

export async function createGroupAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = groupInputSchema.safeParse({
    name: formData.get('name'),
    directionId: formData.get('directionId'),
    locationId: formData.get('locationId'),
    capacity: Number(formData.get('capacity')),
    durationMinutes: Number(formData.get('durationMinutes')),
    isOpenForEnrollment: formData.get('isOpenForEnrollment') === 'on',
    startsOn: formData.get('startsOn'),
    endsOn: String(formData.get('endsOn') ?? '') || null,
    schedule: readSchedule(formData),
  });

  if (!parsed.success) {
    return {
      error: 'Перевірте заповнені поля.',
      fieldErrors: flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const accessToken = await requireToken();

  try {
    const saved = await api.createGroup(parsed.data, accessToken);
    revalidatePath('/cabinet/groups');
    revalidatePath('/cabinet');

    // The result is not just "saved": some meetings may not have fitted, and
    // a timetable with a silent hole in it is worse than one that says so.
    return saved.skippedOccurrences.length > 0
      ? { done: true, error: describeSkipped(saved.skippedOccurrences) }
      : { done: true };
  } catch (error) {
    return { error: describeError(error), fieldErrors: fieldErrorsOf(error) };
  }
}

/**
 * A weekday and a time per row; a row with no time is a row the teacher left
 * empty. Duplicates are caught by the shared schema rather than here.
 */
function readSchedule(formData: FormData) {
  const schedule = [];

  for (let index = 0; index < MEETING_SLOTS; index += 1) {
    const startTime = String(formData.get(`startTime-${index}`) ?? '').trim();
    if (!startTime) {
      continue;
    }
    schedule.push({ weekday: Number(formData.get(`weekday-${index}`)), startTime });
  }

  return schedule;
}

function describeSkipped(occurrences: readonly string[]): string {
  const dates = occurrences
    .map((value) =>
      new Date(value).toLocaleString('uk-UA', {
        timeZone: 'Europe/Kyiv',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      }),
    )
    .join(', ');

  return `Групу збережено, але цей час уже зайнятий і заняття не створено: ${dates}.`;
}

export async function applyToGroupAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const groupId = String(formData.get('groupId') ?? '');
  const accessToken = await readAccessToken();

  if (!accessToken) {
    // The session ran out between opening the page and pressing the button.
    redirect(`/login?next=${encodeURIComponent(`/groups/${groupId}`)}`);
  }

  try {
    await api.applyToGroup(groupId, accessToken);
  } catch (error) {
    return { error: describeError(error) };
  }

  revalidatePath(`/groups/${groupId}`);
  redirect('/cabinet?applied=1');
}

type GroupAction = (formData: FormData) => Promise<void>;

/**
 * The buttons on a roster. Forms rather than links, like every other action
 * that changes state: a prefetch must not be able to admit somebody to a
 * group.
 */
function enrollmentAction(
  run: (groupId: string, enrollmentId: string, token: string) => Promise<unknown>,
): GroupAction {
  return async (formData: FormData) => {
    const groupId = String(formData.get('groupId') ?? '');
    const enrollmentId = String(formData.get('enrollmentId') ?? '');
    const accessToken = await requireToken();
    const back = `/cabinet/groups/${groupId}`;

    try {
      await run(groupId, enrollmentId, accessToken);
    } catch (error) {
      redirect(`${back}?error=${encodeURIComponent(describeError(error))}`);
    }

    revalidatePath(back);
    redirect(back);
  };
}

export const approveEnrollmentAction = enrollmentAction((groupId, enrollmentId, token) =>
  api.approveEnrollment(groupId, enrollmentId, token),
);

export const removeEnrollmentAction = enrollmentAction((groupId, enrollmentId, token) =>
  api.removeEnrollment(groupId, enrollmentId, token),
);

/** A student withdrawing from the cabinet ends up back in the cabinet. */
export async function leaveGroupAction(formData: FormData): Promise<void> {
  const groupId = String(formData.get('groupId') ?? '');
  const enrollmentId = String(formData.get('enrollmentId') ?? '');
  const accessToken = await requireToken();

  try {
    await api.removeEnrollment(groupId, enrollmentId, accessToken);
  } catch (error) {
    redirect(`/cabinet?error=${encodeURIComponent(describeError(error))}`);
  }

  revalidatePath('/cabinet');
  redirect('/cabinet');
}

/**
 * The register is saved whole: the form carries a mark for every member, and
 * "не відмічено" is a real answer that removes the row rather than leaving
 * last week's.
 */
export async function saveAttendanceAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const lessonId = String(formData.get('lessonId') ?? '');
  const entries = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('mark-') || typeof value !== 'string' || value === '') {
      continue;
    }
    entries.push({ studentId: key.slice('mark-'.length), status: value as AttendanceStatus });
  }

  const parsed = attendanceUpdateSchema.safeParse({ entries });
  if (!parsed.success) {
    return { error: 'Перевірте журнал.' };
  }

  const accessToken = await requireToken();

  try {
    await api.saveAttendance(lessonId, parsed.data, accessToken);
  } catch (error) {
    return { error: describeError(error) };
  }

  revalidatePath(`/cabinet/lessons/${lessonId}/attendance`);
  return { done: true };
}

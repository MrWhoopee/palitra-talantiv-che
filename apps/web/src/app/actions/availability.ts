'use server';

import {
  addLocalDays,
  availabilityExceptionInputSchema,
  availabilityRuleInputSchema,
  fromZonedTime,
  parseLocalDate,
} from '@palitra/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { flattenError } from 'zod';
import { api } from '@/lib/api';
import { describeError, fieldErrorsOf } from '@/lib/error-messages';
import type { FormState } from '@/lib/form-state';
import { readAccessToken } from '@/lib/session';

const AVAILABILITY_PATH = '/cabinet/schedule';

/**
 * The teacher's own schedule. Their id travels in the form because the
 * endpoint is addressed by teacher - an admin uses the same screen for
 * somebody else's timetable - and the API refuses any id but the caller's
 * unless the caller is an admin.
 */
export async function createRuleAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const teacherId = String(formData.get('teacherId') ?? '');
  const parsed = availabilityRuleInputSchema.safeParse({
    locationId: formData.get('locationId'),
    weekday: Number(formData.get('weekday')),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    validFrom: formData.get('validFrom'),
    validTo: String(formData.get('validTo') ?? '') || null,
  });

  if (!parsed.success) {
    return {
      error: 'Перевірте заповнені поля.',
      fieldErrors: flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const accessToken = await readAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  try {
    await api.createAvailabilityRule(teacherId, parsed.data, accessToken);
  } catch (error) {
    return { error: describeError(error), fieldErrors: fieldErrorsOf(error) };
  }

  revalidatePath(AVAILABILITY_PATH);
  return { done: true };
}

export async function createExceptionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const teacherId = String(formData.get('teacherId') ?? '');
  const parsed = availabilityExceptionInputSchema.safeParse({
    // The form collects local dates; the API stores instants, so the two ends
    // are pinned to the start and the end of the chosen days.
    startsAt: toInstant(formData.get('startsOn'), '00:00'),
    endsAt: toInstant(formData.get('endsOn'), '24:00'),
    kind: formData.get('kind'),
    note: String(formData.get('note') ?? '') || null,
  });

  if (!parsed.success) {
    return {
      error: 'Перевірте дати відсутності.',
      fieldErrors: flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const accessToken = await readAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  try {
    await api.createAvailabilityException(teacherId, parsed.data, accessToken);
  } catch (error) {
    return { error: describeError(error) };
  }

  revalidatePath(AVAILABILITY_PATH);
  return { done: true };
}

export async function deleteRuleAction(formData: FormData): Promise<void> {
  const accessToken = await readAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  await api.deleteAvailabilityRule(
    String(formData.get('teacherId') ?? ''),
    String(formData.get('ruleId') ?? ''),
    accessToken,
  );

  revalidatePath(AVAILABILITY_PATH);
  redirect(AVAILABILITY_PATH);
}

export async function deleteExceptionAction(formData: FormData): Promise<void> {
  const accessToken = await readAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  await api.deleteAvailabilityException(
    String(formData.get('teacherId') ?? ''),
    String(formData.get('exceptionId') ?? ''),
    accessToken,
  );

  revalidatePath(AVAILABILITY_PATH);
  redirect(AVAILABILITY_PATH);
}

/**
 * A local day plus a wall-clock time, as an instant in the studio's zone.
 * `"24:00"` means the end of that day, which is how a holiday that includes
 * its last date is expressed.
 */
function toInstant(day: FormDataEntryValue | null, time: '00:00' | '24:00'): string {
  const date = parseLocalDate(String(day ?? ''));
  if (!date) {
    return '';
  }

  const target = time === '24:00' ? addLocalDays(date, 1) : date;
  return fromZonedTime(target, 0).toISOString();
}

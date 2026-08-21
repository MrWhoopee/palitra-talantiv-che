'use server';

import { teacherInviteSchema, teacherPatchSchema, type TeacherPatch } from '@palitra/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { flattenError } from 'zod';
import { adminApi } from '@/lib/admin-api';
import { describeError, fieldErrorsOf } from '@/lib/error-messages';
import type { FormState } from '@/lib/form-state';
import { readAccessToken } from '@/lib/session';

async function requireToken(): Promise<string> {
  const accessToken = await readAccessToken();
  if (!accessToken) {
    redirect('/login');
  }
  return accessToken;
}

/** Everything the person typed, so a rejected form comes back filled in. */
function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value === 'string') {
      values[name] = value;
    }
  }
  return values;
}

export async function inviteTeacherAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = teacherInviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: 'Перевірте заповнені поля.',
      fieldErrors: flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      values: submittedValues(formData),
    };
  }

  const accessToken = await requireToken();

  try {
    await adminApi.inviteTeacher(parsed.data, accessToken);
  } catch (error) {
    return {
      error: describeError(error),
      fieldErrors: fieldErrorsOf(error),
      values: submittedValues(formData),
    };
  }

  revalidatePath('/admin/teachers');
  revalidatePath('/admin');
  return { done: true };
}

/**
 * The card, saved in one submit even though it is three requests: the account
 * fields and the profile go together in a patch, and a portrait chosen at the
 * same time is uploaded first so that the patch has an address to store.
 *
 * Uploading before validating would leave an orphaned file behind whenever the
 * form is wrong, so the patch is built and checked first.
 */
export async function updateTeacherAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const teacherId = String(formData.get('teacherId') ?? '');
  const experience = String(formData.get('experienceYears') ?? '').trim();

  const parsed = teacherPatchSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
    bio: formData.get('bio'),
    // An empty box means "not stated", which `z.coerce.number()` would read as
    // a teacher with no experience at all.
    experienceYears: experience === '' ? null : experience,
    isPublished: formData.get('isPublished') === 'on',
    isActive: formData.get('isActive') === 'on',
    sortOrder: formData.get('sortOrder'),
  });

  if (!parsed.success) {
    return {
      error: 'Перевірте заповнені поля.',
      fieldErrors: flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      values: submittedValues(formData),
    };
  }

  const accessToken = await requireToken();
  const photo = formData.get('photo');

  try {
    const patch: TeacherPatch = { ...parsed.data };

    if (formData.get('removePhoto') === 'on') {
      patch.photoUrl = null;
    } else if (photo instanceof File && photo.size > 0) {
      const stored = await adminApi.uploadImage(photo, 'portrait', accessToken);
      patch.photoUrl = stored.url;
    }

    await adminApi.updateTeacher(teacherId, patch, accessToken);
  } catch (error) {
    return {
      error: describeError(error),
      fieldErrors: fieldErrorsOf(error),
      values: submittedValues(formData),
    };
  }

  revalidatePath(`/admin/teachers/${teacherId}`);
  revalidatePath('/admin/teachers');
  revalidatePath('/teachers');
  return { done: true };
}

/**
 * Both link lists in one action: they differ only in which endpoint the set of
 * ids goes to, and a checkbox that is off is simply a box the browser does not
 * submit - which is exactly what "these are the subjects now" means.
 */
export async function setTeacherLinksAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const teacherId = String(formData.get('teacherId') ?? '');
  const kind = formData.get('kind') === 'locations' ? 'locations' : 'directions';
  const ids = formData.getAll('ids').map(String);

  const accessToken = await requireToken();

  try {
    await (kind === 'locations'
      ? adminApi.setTeacherLocations(teacherId, ids, accessToken)
      : adminApi.setTeacherDirections(teacherId, ids, accessToken));
  } catch (error) {
    return { error: describeError(error) };
  }

  revalidatePath(`/admin/teachers/${teacherId}`);
  revalidatePath('/teachers');
  return { done: true };
}

export async function reinviteTeacherAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const teacherId = String(formData.get('teacherId') ?? '');
  const accessToken = await requireToken();

  try {
    await adminApi.reinviteTeacher(teacherId, accessToken);
  } catch (error) {
    return { error: describeError(error) };
  }

  revalidatePath(`/admin/teachers/${teacherId}`);
  return { done: true };
}

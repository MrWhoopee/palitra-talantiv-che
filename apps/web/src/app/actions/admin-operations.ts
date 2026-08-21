'use server';

import { bookingRequestSchema, subscriptionInputSchema } from '@palitra/shared';
import { flattenError } from 'zod';
import { adminApi } from '@/lib/admin-api';
import { requireToken, revalidateAll, submittedValues } from '@/lib/admin-table';
import { describeError, fieldErrorsOf } from '@/lib/error-messages';
import type { FormState } from '@/lib/form-state';
import { fromDateTimeInput } from '@/lib/studio-time';

/**
 * Running the studio, as opposed to filling its site.
 *
 * None of these is a table with rows to add and remove, so none of them goes
 * through `AdminTable`. What they have in common is narrower than that: a
 * button that does one thing to one row, and a page or two that now shows
 * something else.
 */

const SCHEDULE_PATHS = ['/admin/schedule', '/admin', '/cabinet/schedule'];
const SUBSCRIPTION_PATHS = ['/admin/subscriptions', '/admin', '/cabinet'];
const ENROLLMENT_PATHS = ['/admin/enrollments', '/admin/groups', '/admin', '/groups'];

/**
 * The lesson the studio books over the phone.
 *
 * The form asks for a time rather than offering the free ones. Rebuilding the
 * slot picker here would be a second implementation of the rule about what is
 * free, and the API refuses a time that is taken or outside the teacher's
 * hours - so the studio, which knows those hours, types the time and is told
 * plainly when it will not do.
 */
export async function bookForStudentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const kind = String(formData.get('kind') ?? 'SINGLE');
  const subscriptionId = String(formData.get('subscriptionId') ?? '');
  const pricePlanId = String(formData.get('pricePlanId') ?? '');

  const parsed = bookingRequestSchema.safeParse({
    studentId: formData.get('studentId'),
    teacherId: formData.get('teacherId'),
    locationId: formData.get('locationId'),
    // Exactly the one that applies: the schema refuses a request carrying
    // both, because then the plan and the package could disagree about how
    // long the lesson is.
    ...(kind === 'SUBSCRIPTION'
      ? { subscriptionId: subscriptionId === '' ? undefined : subscriptionId }
      : { pricePlanId: pricePlanId === '' ? undefined : pricePlanId }),
    startsAt: fromDateTimeInput(String(formData.get('startsAt') ?? '')),
    kind,
  });

  if (!parsed.success) {
    return {
      error: 'Перевірте заповнені поля.',
      fieldErrors: flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      values: submittedValues(formData),
    };
  }

  const accessToken = await requireToken();

  try {
    await adminApi.bookForStudent(parsed.data, accessToken);
  } catch (error) {
    return {
      error: describeError(error),
      fieldErrors: fieldErrorsOf(error),
      values: submittedValues(formData),
    };
  }

  revalidateAll(SCHEDULE_PATHS);
  return { done: true };
}

export async function cancelLessonAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get('id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const accessToken = await requireToken();

  try {
    await adminApi.cancelLesson(
      id,
      {
        ...(reason === '' ? {} : { reason }),
        // The studio calling a lesson off is not the family being late with
        // it, so the package is not charged. A late cancellation that should
        // cost a lesson is the teacher's call, from their own cabinet.
        waiveCharge: true,
      },
      accessToken,
    );
  } catch (error) {
    return { error: describeError(error) };
  }

  revalidateAll(SCHEDULE_PATHS);
  return { done: true };
}

export async function issueSubscriptionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = subscriptionInputSchema.safeParse({
    studentId: formData.get('studentId'),
    teacherId: formData.get('teacherId'),
    pricePlanId: formData.get('pricePlanId'),
    validFrom: formData.get('validFrom'),
    validTo: formData.get('validTo'),
    paid: formData.get('paid') === 'on',
  });

  if (!parsed.success) {
    return {
      error: 'Перевірте заповнені поля.',
      fieldErrors: flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      values: submittedValues(formData),
    };
  }

  const accessToken = await requireToken();

  try {
    await adminApi.issueSubscription(parsed.data, accessToken);
  } catch (error) {
    return {
      error: describeError(error),
      fieldErrors: fieldErrorsOf(error),
      values: submittedValues(formData),
    };
  }

  revalidateAll(SUBSCRIPTION_PATHS);
  return { done: true };
}

export async function markSubscriptionPaidAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return act(
    (id, accessToken) => adminApi.markSubscriptionPaid(id, accessToken),
    formData,
    SUBSCRIPTION_PATHS,
  );
}

export async function cancelSubscriptionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return act(
    (id, accessToken) => adminApi.cancelSubscription(id, accessToken),
    formData,
    SUBSCRIPTION_PATHS,
  );
}

export async function approveEnrollmentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return act(
    (id, accessToken) => adminApi.approveEnrollment(id, accessToken),
    formData,
    ENROLLMENT_PATHS,
  );
}

export async function removeEnrollmentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return act(
    (id, accessToken) => adminApi.removeEnrollment(id, accessToken),
    formData,
    ENROLLMENT_PATHS,
  );
}

/**
 * A button that does one thing to one row. Four of the actions above are that
 * and nothing else, and the failure is worth reading rather than swallowing:
 * a group with no places left refuses an approval, which is the right answer
 * and not a fault.
 */
async function act(
  run: (id: string, accessToken: string) => Promise<unknown>,
  formData: FormData,
  paths: string[],
): Promise<FormState> {
  const id = String(formData.get('id') ?? '');
  const accessToken = await requireToken();

  try {
    await run(id, accessToken);
  } catch (error) {
    return { error: describeError(error) };
  }

  revalidateAll(paths);
  return { done: true };
}

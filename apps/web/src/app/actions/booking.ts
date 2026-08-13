'use server';

import { bookingRequestSchema } from '@palitra/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { describeError } from '@/lib/error-messages';
import type { FormState } from '@/lib/form-state';
import { readAccessToken } from '@/lib/session';

/**
 * The booking form posts the exact slot the calendar offered - teacher,
 * address, tariff and instant - rather than a time the visitor typed. The
 * server re-checks all of it; this only keeps the request honest.
 */
export async function bookSlotAction(_previous: FormState, formData: FormData): Promise<FormState> {
  // A submit button can carry one name and one value, and a slot is two facts
  // - when and where - so the calendar sends them joined and they are split
  // here rather than duplicating the grid into hidden inputs.
  const [startsAt, locationId] = String(formData.get('slot') ?? '').split('|');

  const parsed = bookingRequestSchema.safeParse({
    teacherId: formData.get('teacherId'),
    pricePlanId: formData.get('pricePlanId'),
    kind: formData.get('kind'),
    startsAt,
    locationId,
  });

  if (!parsed.success) {
    return { error: 'Оберіть тариф і вільний час зі списку.' };
  }

  const accessToken = await readAccessToken();
  if (!accessToken) {
    // The session ran out between opening the page and pressing the button.
    redirect(`/login?next=${encodeURIComponent(`/teachers/${parsed.data.teacherId}`)}`);
  }

  try {
    await api.createBooking(parsed.data, accessToken);
  } catch (error) {
    return { error: describeError(error) };
  }

  redirect('/cabinet?booked=1');
}

type LessonAction = (formData: FormData) => Promise<void>;

/**
 * The four buttons on a lesson card. They change server state, so each is a
 * form rather than a link: a prefetch or a crawler must never be able to
 * confirm somebody's lesson.
 */
function lessonAction(
  run: (lessonId: string, token: string, formData: FormData) => Promise<void>,
): LessonAction {
  return async (formData: FormData) => {
    const lessonId = String(formData.get('lessonId') ?? '');
    const accessToken = await readAccessToken();

    if (!lessonId || !accessToken) {
      redirect('/login');
    }

    try {
      await run(lessonId, accessToken, formData);
    } catch (error) {
      // A failed action lands back on the cabinet with the reason in the URL,
      // because a plain `action={fn}` form has nowhere else to put it.
      redirect(`/cabinet?error=${encodeURIComponent(describeError(error))}`);
    }

    revalidatePath('/cabinet');
    redirect('/cabinet');
  };
}

export const confirmLessonAction = lessonAction((lessonId, token) =>
  api.confirmLesson(lessonId, token).then(() => undefined),
);

export const cancelLessonAction = lessonAction((lessonId, token, formData) => {
  const reason = String(formData.get('reason') ?? '').trim();
  return api.cancelLesson(lessonId, reason || undefined, token).then(() => undefined);
});

export const completeLessonAction = lessonAction((lessonId, token) =>
  api.completeLesson(lessonId, token).then(() => undefined),
);

export const noShowLessonAction = lessonAction((lessonId, token) =>
  api.markNoShow(lessonId, token).then(() => undefined),
);

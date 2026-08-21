'use server';

import {
  achievementInputSchema,
  galleryItemInputSchema,
  galleryItemPatchSchema,
  studioEventInputSchema,
  testimonialInputSchema,
} from '@palitra/shared';
import { redirect } from 'next/navigation';
import { adminApi } from '@/lib/admin-api';
import {
  removeRow,
  requireToken,
  revalidateAll,
  saveRow,
  submittedValues,
  type AdminTable,
} from '@/lib/admin-table';
import { describeError, fieldErrorsOf } from '@/lib/error-messages';
import type { FormState } from '@/lib/form-state';
import { flattenError } from 'zod';
import { fromDateTimeInput } from '@/lib/studio-time';

/**
 * The four content tables: the playbill, the gallery, what people said, what
 * the studio won.
 *
 * Same shape as the reference tables and the same machinery behind it - read a
 * form, check it, write it, name the pages that now show something else. What
 * differs is that three of these carry a picture, which is what `attach` is
 * for: it runs after the fields are checked, so a form that comes back with a
 * mistake in it does not leave a file on disk with nothing pointing at it.
 */

const EVENTS: AdminTable<ReturnType<typeof studioEventInputSchema.parse>> = {
  schema: studioEventInputSchema,
  read: (formData) => ({
    slug: formData.get('slug'),
    title: formData.get('title'),
    description: formData.get('description'),
    // The boxes speak Kyiv's wall clock; the API speaks instants.
    startsAt: fromDateTimeInput(String(formData.get('startsAt') ?? '')),
    endsAt: fromDateTimeInput(String(formData.get('endsAt') ?? '')),
    locationId: emptyToNull(formData.get('locationId')),
    coverUrl: formData.get('coverUrl'),
    kind: formData.get('kind'),
    isPublished: formData.get('isPublished') === 'on',
  }),
  attach: async (input, formData, accessToken) => {
    if (formData.get('removeCover') === 'on') {
      return { ...input, coverUrl: null };
    }

    const cover = formData.get('cover');
    if (!(cover instanceof File) || cover.size === 0) {
      return input;
    }

    const stored = await adminApi.uploadImage(cover, 'cover', accessToken);
    return { ...input, coverUrl: stored.url };
  },
  create: (input, accessToken) => adminApi.createEvent(input, accessToken),
  update: (id, patch, accessToken) => adminApi.updateEvent(id, patch, accessToken),
  remove: (id, accessToken) => adminApi.deleteEvent(id, accessToken),
  paths: ['/admin/events', '/', '/events'],
};

/**
 * Editing an item, and adding a video - both cases where the address is
 * already known. A new photo has none until it is stored, which is a different
 * enough job to be its own action below.
 */
const GALLERY: AdminTable<ReturnType<typeof galleryItemInputSchema.parse>> = {
  schema: galleryItemInputSchema,
  read: (formData) => ({
    kind: formData.get('kind'),
    url: formData.get('url'),
    thumbUrl: formData.get('thumbUrl'),
    caption: formData.get('caption'),
    eventId: emptyToNull(formData.get('eventId')),
    isPublished: formData.get('isPublished') === 'on',
  }),
  create: (input, accessToken) => adminApi.createGalleryItem(input, accessToken),
  update: (id, patch, accessToken) => adminApi.updateGalleryItem(id, patch, accessToken),
  remove: (id, accessToken) => adminApi.deleteGalleryItem(id, accessToken),
  paths: ['/admin/gallery', '/gallery'],
};

const TESTIMONIALS: AdminTable<ReturnType<typeof testimonialInputSchema.parse>> = {
  schema: testimonialInputSchema,
  read: (formData) => ({
    authorName: formData.get('authorName'),
    text: formData.get('text'),
    sortOrder: formData.get('sortOrder'),
    isPublished: formData.get('isPublished') === 'on',
  }),
  create: (input, accessToken) => adminApi.createTestimonial(input, accessToken),
  update: (id, patch, accessToken) => adminApi.updateTestimonial(id, patch, accessToken),
  remove: (id, accessToken) => adminApi.deleteTestimonial(id, accessToken),
  paths: ['/admin/testimonials', '/'],
};

const ACHIEVEMENTS: AdminTable<ReturnType<typeof achievementInputSchema.parse>> = {
  schema: achievementInputSchema,
  read: (formData) => ({
    title: formData.get('title'),
    description: formData.get('description'),
    year: formData.get('year'),
    imageUrl: formData.get('imageUrl'),
    sortOrder: formData.get('sortOrder'),
    isPublished: formData.get('isPublished') === 'on',
  }),
  attach: async (input, formData, accessToken) => {
    if (formData.get('removeImage') === 'on') {
      return { ...input, imageUrl: null };
    }

    const image = formData.get('image');
    if (!(image instanceof File) || image.size === 0) {
      return input;
    }

    const stored = await adminApi.uploadImage(image, 'cover', accessToken);
    return { ...input, imageUrl: stored.url };
  },
  create: (input, accessToken) => adminApi.createAchievement(input, accessToken),
  update: (id, patch, accessToken) => adminApi.updateAchievement(id, patch, accessToken),
  remove: (id, accessToken) => adminApi.deleteAchievement(id, accessToken),
  paths: ['/admin/achievements', '/achievements'],
};

export async function saveEventAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRow(EVENTS, formData);
}

/**
 * Deleting is the one write that leaves the screen it was pressed on: the
 * event's own page has no event any more. The redirect happens after the
 * delete succeeded, so a refusal still comes back as a message on the card.
 */
export async function deleteEventAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const state = await removeRow(EVENTS, formData);

  if (state.done) {
    redirect('/admin/events');
  }

  return state;
}

export async function saveGalleryItemAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRow(GALLERY, formData);
}

export async function deleteGalleryItemAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return removeRow(GALLERY, formData);
}

/**
 * A photo, which arrives as a file rather than as an address.
 *
 * The words are checked first, against the patch schema - it is the same rules
 * without the address, which is the one field the form does not have yet. Only
 * then is the picture sent, so a caption that was too long does not leave a
 * stored file with nothing pointing at it.
 */
export async function addGalleryPhotoAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const photo = formData.get('photo');
  const isPublished = formData.get('isPublished') === 'on';

  const checked = galleryItemPatchSchema.safeParse({
    caption: formData.get('caption'),
    eventId: emptyToNull(formData.get('eventId')),
  });

  if (!checked.success) {
    return {
      error: 'Перевірте заповнені поля.',
      fieldErrors: flattenError(checked.error).fieldErrors as Record<string, string[]>,
      values: submittedValues(formData),
    };
  }

  if (!(photo instanceof File) || photo.size === 0) {
    return {
      error: 'Оберіть фото.',
      fieldErrors: { photo: ['Без файлу немає чого додавати'] },
      values: submittedValues(formData),
    };
  }

  const accessToken = await requireToken();

  try {
    const stored = await adminApi.uploadImage(photo, 'gallery', accessToken);

    await adminApi.createGalleryItem(
      {
        kind: 'PHOTO',
        url: stored.url,
        thumbUrl: stored.thumbUrl ?? null,
        caption: checked.data.caption ?? null,
        eventId: checked.data.eventId ?? null,
        isPublished,
      },
      accessToken,
    );
  } catch (error) {
    return {
      error: describeError(error),
      fieldErrors: fieldErrorsOf(error),
      values: submittedValues(formData),
    };
  }

  revalidateAll(GALLERY.paths);
  return { done: true };
}

/**
 * One photo one place up or down, sent as the whole new running order.
 *
 * The screen submits the order it is currently showing, so the swap is
 * computed against what the person was looking at rather than against a list
 * that may have changed since. An id that is not in it, or a move off either
 * end, is a no-op: the buttons at the ends are disabled, and a form posted
 * twice should not shuffle anything.
 */
export async function moveGalleryItemAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const ids = String(formData.get('ids') ?? '')
    .split(',')
    .filter((id) => id !== '');
  const id = String(formData.get('id') ?? '');
  const step = formData.get('direction') === 'up' ? -1 : 1;

  const from = ids.indexOf(id);
  const to = from + step;

  if (from === -1 || to < 0 || to >= ids.length) {
    return {};
  }

  const reordered = [...ids];
  [reordered[from], reordered[to]] = [reordered[to] as string, reordered[from] as string];

  const accessToken = await requireToken();

  try {
    await adminApi.reorderGallery(reordered, accessToken);
  } catch (error) {
    return { error: describeError(error) };
  }

  revalidateAll(GALLERY.paths);
  return { done: true };
}

export async function saveTestimonialAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRow(TESTIMONIALS, formData);
}

export async function deleteTestimonialAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return removeRow(TESTIMONIALS, formData);
}

export async function saveAchievementAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRow(ACHIEVEMENTS, formData);
}

export async function deleteAchievementAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return removeRow(ACHIEVEMENTS, formData);
}

/** A `<select>` with nothing chosen posts an empty string, which is not an id. */
function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim();
  return text === '' ? null : text;
}

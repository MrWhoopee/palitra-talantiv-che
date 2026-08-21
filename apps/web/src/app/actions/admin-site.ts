'use server';

import { siteSettingsSchema, siteTextInputSchema, siteTextKeySchema } from '@palitra/shared';
import { flattenError } from 'zod';
import { adminApi } from '@/lib/admin-api';
import { requireToken, revalidateAll, submittedValues } from '@/lib/admin-table';
import { describeError, fieldErrorsOf } from '@/lib/error-messages';
import type { FormState } from '@/lib/form-state';
import { SITE_PAGE_PATHS } from '@/lib/site-pages';

/**
 * The studio's own words: the copy on its pages, and the facts in the footer.
 *
 * Neither is a table with rows to add and remove, which is why these two are
 * not written through `AdminTable` like everything else in the cabinet. A page
 * is written by a key the app already knows, and the settings are one form
 * saved in one press - there is no create, no delete, and nothing to order.
 */

export async function saveSiteTextAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const key = siteTextKeySchema.safeParse(formData.get('key'));
  const parsed = siteTextInputSchema.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
  });

  if (!key.success) {
    // Not a field the person filled in: the key is written into the form by
    // the screen, from the fixed list. Reaching here means the form was built
    // wrong, not that anything was typed wrong.
    return { error: 'Невідома сторінка. Оновіть сторінку кабінету.' };
  }

  if (!parsed.success) {
    return {
      error: 'Перевірте заповнені поля.',
      fieldErrors: flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      values: submittedValues(formData),
    };
  }

  const accessToken = await requireToken();

  try {
    await adminApi.saveSiteText(key.data, parsed.data, accessToken);
  } catch (error) {
    return {
      error: describeError(error),
      fieldErrors: fieldErrorsOf(error),
      values: submittedValues(formData),
    };
  }

  revalidateAll(['/admin/pages', ...SITE_PAGE_PATHS]);
  return { done: true };
}

/**
 * The contacts, saved as a whole.
 *
 * Every box on the screen is sent, including the empty ones: an empty value is
 * how the studio takes a line back out of the footer, and a key left out of
 * the request would instead keep whatever it had. The two are opposite
 * intentions, so the form says which it means by sending everything.
 */
export async function saveSiteSettingsAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = siteSettingsSchema.safeParse({
    phone: formData.get('phone'),
    email: formData.get('email'),
    instagram: formData.get('instagram'),
    telegram: formData.get('telegram'),
    facebook: formData.get('facebook'),
    workingHours: formData.get('workingHours'),
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
    await adminApi.saveSiteSettings(parsed.data, accessToken);
  } catch (error) {
    return {
      error: describeError(error),
      fieldErrors: fieldErrorsOf(error),
      values: submittedValues(formData),
    };
  }

  // The footer is on every page of the site, so there is no shorter list to
  // name here than the pages that have one.
  revalidateAll(['/admin/contacts', '/', '/about', '/rules', '/contacts', '/teachers', '/events']);
  return { done: true };
}

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { flattenError, type ZodType } from 'zod';
import { describeError, fieldErrorsOf } from '@/lib/error-messages';
import type { FormState } from '@/lib/form-state';
import { readAccessToken } from '@/lib/session';

/**
 * One row of the cabinet, whatever table it belongs to.
 *
 * Every screen in the cabinet does the same five things - read a form, check
 * it, create or patch, say what went wrong, mark the pages that now show
 * something else - and differs only in which fields and which calls. That
 * shape is written here once so the tenth table cannot be the one where the
 * `revalidatePath` was forgotten.
 *
 * Not in an `'use server'` file: such a module may export async functions and
 * nothing else, so an interface and a helper cannot live next to the actions
 * that use them.
 */
export interface AdminTable<T> {
  schema: ZodType<T>;
  /** The form's fields, in the shape the schema expects to check. */
  read(formData: FormData): unknown;
  create(input: T, accessToken: string): Promise<unknown>;
  update(id: string, patch: T, accessToken: string): Promise<unknown>;
  remove(id: string, accessToken: string): Promise<void>;
  /**
   * A picture chosen in the same submit. It runs after the fields are checked
   * and never before: uploading first would leave a file on disk with nothing
   * pointing at it every time a form comes back with a mistake in it.
   */
  attach?(input: T, formData: FormData, accessToken: string): Promise<T>;
  /**
   * Pages that show this table. The public ones are `force-dynamic` today and
   * would refetch anyway; they are named so that the day one of them is cached
   * it does not silently keep showing last week's playbill.
   */
  paths: string[];
}

/**
 * One form for adding and for editing: the row being edited carries its id in
 * a hidden field and the empty one at the bottom does not. The screen shows
 * every field either way, so an edit can send the whole set - a patch of all
 * of it is the same thing as all of it.
 */
export async function saveRow<T>(table: AdminTable<T>, formData: FormData): Promise<FormState> {
  const parsed = table.schema.safeParse(table.read(formData));

  if (!parsed.success) {
    return {
      error: 'Перевірте заповнені поля.',
      fieldErrors: flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      values: submittedValues(formData),
    };
  }

  const accessToken = await requireToken();
  const id = String(formData.get('id') ?? '');

  try {
    const input = table.attach
      ? await table.attach(parsed.data, formData, accessToken)
      : parsed.data;

    await (id === '' ? table.create(input, accessToken) : table.update(id, input, accessToken));
  } catch (error) {
    return {
      error: describeError(error),
      fieldErrors: fieldErrorsOf(error),
      values: submittedValues(formData),
    };
  }

  revalidateAll(table.paths);
  return { done: true };
}

export async function removeRow<T>(table: AdminTable<T>, formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') ?? '');
  const accessToken = await requireToken();

  try {
    await table.remove(id, accessToken);
  } catch (error) {
    // Usually `IN_USE`: the studio is trying to delete something the schedule
    // is built on, and the message says which way out there is.
    return { error: describeError(error) };
  }

  revalidateAll(table.paths);
  return { done: true };
}

export function revalidateAll(paths: readonly string[]): void {
  for (const path of paths) {
    revalidatePath(path);
  }
}

export async function requireToken(): Promise<string> {
  const accessToken = await readAccessToken();
  if (!accessToken) {
    redirect('/login');
  }
  return accessToken;
}

/** Everything the person typed, so a rejected form comes back filled in. */
export function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value === 'string') {
      values[name] = value;
    }
  }
  return values;
}

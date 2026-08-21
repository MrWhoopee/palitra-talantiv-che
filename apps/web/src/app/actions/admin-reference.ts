'use server';

import {
  directionInputSchema,
  locationInputSchema,
  pricePlanInputSchema,
} from '@palitra/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { flattenError, type ZodType } from 'zod';
import { adminApi } from '@/lib/admin-api';
import { describeError, fieldErrorsOf } from '@/lib/error-messages';
import type { FormState } from '@/lib/form-state';
import { readAccessToken } from '@/lib/session';

/**
 * The three reference tables, which differ only in their fields.
 *
 * One shape describes each of them - how to read its form, which calls write
 * it, and which pages go stale when it changes - and the actions below are
 * four lines each. The alternative was the same twenty lines of parse, catch
 * and revalidate written out three times, where the third copy is where the
 * mistake lives.
 */
interface Table<T> {
  schema: ZodType<T>;
  read(formData: FormData): unknown;
  create(input: T, accessToken: string): Promise<unknown>;
  update(id: string, patch: T, accessToken: string): Promise<unknown>;
  remove(id: string, accessToken: string): Promise<void>;
  /**
   * Pages that show this table. The public ones are `force-dynamic` today and
   * would refetch anyway; they are named so that the day one of them is cached
   * it does not silently start showing last week's prices.
   */
  paths: string[];
}

const LOCATIONS: Table<ReturnType<typeof locationInputSchema.parse>> = {
  schema: locationInputSchema,
  read: (formData) => ({
    name: formData.get('name'),
    address: formData.get('address'),
    mapUrl: formData.get('mapUrl'),
    sortOrder: formData.get('sortOrder'),
  }),
  create: (input, accessToken) => adminApi.createLocation(input, accessToken),
  update: (id, patch, accessToken) => adminApi.updateLocation(id, patch, accessToken),
  remove: (id, accessToken) => adminApi.deleteLocation(id, accessToken),
  paths: ['/admin/locations', '/', '/teachers'],
};

const DIRECTIONS: Table<ReturnType<typeof directionInputSchema.parse>> = {
  schema: directionInputSchema,
  read: (formData) => ({
    slug: formData.get('slug'),
    name: formData.get('name'),
    description: formData.get('description'),
    icon: formData.get('icon'),
    sortOrder: formData.get('sortOrder'),
  }),
  create: (input, accessToken) => adminApi.createDirection(input, accessToken),
  update: (id, patch, accessToken) => adminApi.updateDirection(id, patch, accessToken),
  remove: (id, accessToken) => adminApi.deleteDirection(id, accessToken),
  paths: ['/admin/directions', '/', '/directions', '/teachers'],
};

const PRICE_PLANS: Table<ReturnType<typeof pricePlanInputSchema.parse>> = {
  schema: pricePlanInputSchema,
  read: (formData) => ({
    directionId: formData.get('directionId'),
    name: formData.get('name'),
    lessonsCount: formData.get('lessonsCount'),
    durationMinutes: formData.get('durationMinutes'),
    format: formData.get('format'),
    priceUah: formData.get('priceUah'),
    isActive: formData.get('isActive') === 'on',
    sortOrder: formData.get('sortOrder'),
  }),
  create: (input, accessToken) => adminApi.createPricePlan(input, accessToken),
  update: (id, patch, accessToken) => adminApi.updatePricePlan(id, patch, accessToken),
  remove: (id, accessToken) => adminApi.deletePricePlan(id, accessToken),
  paths: ['/admin/prices', '/', '/directions'],
};

export async function saveLocationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return save(LOCATIONS, formData);
}

export async function deleteLocationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return remove(LOCATIONS, formData);
}

export async function saveDirectionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return save(DIRECTIONS, formData);
}

export async function deleteDirectionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return remove(DIRECTIONS, formData);
}

export async function savePricePlanAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return save(PRICE_PLANS, formData);
}

export async function deletePricePlanAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return remove(PRICE_PLANS, formData);
}

/**
 * One form for adding and for editing: the row being edited carries its id in
 * a hidden field and the empty row at the bottom does not. The screen shows
 * every field either way, so an edit can send the whole set - a patch of all
 * of it is the same thing as all of it.
 */
async function save<T>(table: Table<T>, formData: FormData): Promise<FormState> {
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
    await (id === ''
      ? table.create(parsed.data, accessToken)
      : table.update(id, parsed.data, accessToken));
  } catch (error) {
    return {
      error: describeError(error),
      fieldErrors: fieldErrorsOf(error),
      values: submittedValues(formData),
    };
  }

  revalidate(table);
  return { done: true };
}

async function remove<T>(table: Table<T>, formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') ?? '');
  const accessToken = await requireToken();

  try {
    await table.remove(id, accessToken);
  } catch (error) {
    // Usually `IN_USE`: the studio is trying to delete something the schedule
    // is built on, and the message says which way out there is.
    return { error: describeError(error) };
  }

  revalidate(table);
  return { done: true };
}

function revalidate<T>(table: Table<T>): void {
  for (const path of table.paths) {
    revalidatePath(path);
  }
}

async function requireToken(): Promise<string> {
  const accessToken = await readAccessToken();
  if (!accessToken) {
    redirect('/login');
  }
  return accessToken;
}

function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value === 'string') {
      values[name] = value;
    }
  }
  return values;
}

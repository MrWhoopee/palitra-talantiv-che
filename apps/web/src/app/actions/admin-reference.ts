'use server';

import {
  directionInputSchema,
  locationInputSchema,
  pricePlanInputSchema,
} from '@palitra/shared';
import { adminApi } from '@/lib/admin-api';
import { removeRow, saveRow, type AdminTable } from '@/lib/admin-table';
import type { FormState } from '@/lib/form-state';

/**
 * The three reference tables, which differ only in their fields.
 *
 * One shape describes each of them - how to read its form, which calls write
 * it, and which pages go stale when it changes - and the actions below are one
 * line each. The alternative was the same twenty lines of parse, catch and
 * revalidate written out three times, where the third copy is where the
 * mistake lives. That shape now lives in `@/lib/admin-table`, because the
 * content tables turned out to be the same five things again.
 */
const LOCATIONS: AdminTable<ReturnType<typeof locationInputSchema.parse>> = {
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

const DIRECTIONS: AdminTable<ReturnType<typeof directionInputSchema.parse>> = {
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

const PRICE_PLANS: AdminTable<ReturnType<typeof pricePlanInputSchema.parse>> = {
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
  return saveRow(LOCATIONS, formData);
}

export async function deleteLocationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return removeRow(LOCATIONS, formData);
}

export async function saveDirectionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRow(DIRECTIONS, formData);
}

export async function deleteDirectionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return removeRow(DIRECTIONS, formData);
}

export async function savePricePlanAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRow(PRICE_PLANS, formData);
}

export async function deletePricePlanAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return removeRow(PRICE_PLANS, formData);
}

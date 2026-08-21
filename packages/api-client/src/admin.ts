import {
  adminDirectionListSchema,
  adminDirectionSchema,
  adminLocationListSchema,
  adminLocationSchema,
  adminPricePlanListSchema,
  adminPricePlanSchema,
  adminTeacherListSchema,
  adminTeacherSchema,
  siteTextListSchema,
  uploadResultSchema,
  type AdminDirection,
  type AdminLocation,
  type AdminPricePlan,
  type AdminTeacher,
  type DirectionInput,
  type DirectionPatch,
  type LocationInput,
  type LocationPatch,
  type PricePlanInput,
  type PricePlanPatch,
  type SiteText,
  type TeacherInvite,
  type TeacherPatch,
  type UploadKind,
  type UploadResult,
} from '@palitra/shared';
import { createHttp, type ApiClientOptions } from './http';

/**
 * The studio's own client, separate from the public one for the same reason
 * the API's routers are separate: every path here is behind `/admin`, every
 * call carries the admin's token, and nothing on the public site has any
 * business calling one of them.
 *
 * It grows a method per screen. What is here is what the screens that exist
 * actually call - an interface written ahead of its screens is a set of
 * guesses nothing has ever run.
 */
export interface AdminClient {
  getTeachers(accessToken: string): Promise<AdminTeacher[]>;
  getTeacher(teacherId: string, accessToken: string): Promise<AdminTeacher>;
  inviteTeacher(input: TeacherInvite, accessToken: string): Promise<AdminTeacher>;
  updateTeacher(
    teacherId: string,
    patch: TeacherPatch,
    accessToken: string,
  ): Promise<AdminTeacher>;
  setTeacherDirections(
    teacherId: string,
    ids: string[],
    accessToken: string,
  ): Promise<AdminTeacher>;
  setTeacherLocations(teacherId: string, ids: string[], accessToken: string): Promise<AdminTeacher>;
  reinviteTeacher(teacherId: string, accessToken: string): Promise<void>;

  getLocations(accessToken: string): Promise<AdminLocation[]>;
  createLocation(input: LocationInput, accessToken: string): Promise<AdminLocation>;
  updateLocation(id: string, patch: LocationPatch, accessToken: string): Promise<AdminLocation>;
  deleteLocation(id: string, accessToken: string): Promise<void>;

  getDirections(accessToken: string): Promise<AdminDirection[]>;
  createDirection(input: DirectionInput, accessToken: string): Promise<AdminDirection>;
  updateDirection(id: string, patch: DirectionPatch, accessToken: string): Promise<AdminDirection>;
  deleteDirection(id: string, accessToken: string): Promise<void>;

  /** Includes the retired plans, which is what makes this list the admin's. */
  getPricePlans(accessToken: string): Promise<AdminPricePlan[]>;
  createPricePlan(input: PricePlanInput, accessToken: string): Promise<AdminPricePlan>;
  updatePricePlan(id: string, patch: PricePlanPatch, accessToken: string): Promise<AdminPricePlan>;
  deletePricePlan(id: string, accessToken: string): Promise<void>;

  getSiteTexts(accessToken: string): Promise<SiteText[]>;

  /** Stores a picture and answers with its address. Attaching it is a separate call. */
  uploadImage(file: File, kind: UploadKind, accessToken: string): Promise<UploadResult>;
}

export function createAdminClient(options: ApiClientOptions): AdminClient {
  const { request, requestParsed } = createHttp(options);

  return {
    getTeachers: (accessToken) =>
      requestParsed(adminTeacherListSchema, '/admin/teachers', { accessToken }),

    getTeacher: (teacherId, accessToken) =>
      requestParsed(adminTeacherSchema, teacherPath(teacherId), { accessToken }),

    inviteTeacher: (input, accessToken) =>
      requestParsed(adminTeacherSchema, '/admin/teachers', {
        method: 'POST',
        body: input,
        accessToken,
      }),

    updateTeacher: (teacherId, patch, accessToken) =>
      requestParsed(adminTeacherSchema, teacherPath(teacherId), {
        method: 'PATCH',
        body: patch,
        accessToken,
      }),

    setTeacherDirections: (teacherId, ids, accessToken) =>
      requestParsed(adminTeacherSchema, `${teacherPath(teacherId)}/directions`, {
        method: 'PUT',
        body: { ids },
        accessToken,
      }),

    setTeacherLocations: (teacherId, ids, accessToken) =>
      requestParsed(adminTeacherSchema, `${teacherPath(teacherId)}/locations`, {
        method: 'PUT',
        body: { ids },
        accessToken,
      }),

    async reinviteTeacher(teacherId, accessToken) {
      await request(`${teacherPath(teacherId)}/reinvite`, { method: 'POST', accessToken });
    },

    getLocations: (accessToken) =>
      requestParsed(adminLocationListSchema, '/admin/locations', { accessToken }),

    createLocation: (input, accessToken) =>
      requestParsed(adminLocationSchema, '/admin/locations', {
        method: 'POST',
        body: input,
        accessToken,
      }),

    updateLocation: (id, patch, accessToken) =>
      requestParsed(adminLocationSchema, rowPath('locations', id), {
        method: 'PATCH',
        body: patch,
        accessToken,
      }),

    async deleteLocation(id, accessToken) {
      await request(rowPath('locations', id), { method: 'DELETE', accessToken });
    },

    getDirections: (accessToken) =>
      requestParsed(adminDirectionListSchema, '/admin/directions', { accessToken }),

    createDirection: (input, accessToken) =>
      requestParsed(adminDirectionSchema, '/admin/directions', {
        method: 'POST',
        body: input,
        accessToken,
      }),

    updateDirection: (id, patch, accessToken) =>
      requestParsed(adminDirectionSchema, rowPath('directions', id), {
        method: 'PATCH',
        body: patch,
        accessToken,
      }),

    async deleteDirection(id, accessToken) {
      await request(rowPath('directions', id), { method: 'DELETE', accessToken });
    },

    getPricePlans: (accessToken) =>
      requestParsed(adminPricePlanListSchema, '/admin/price-plans', { accessToken }),

    createPricePlan: (input, accessToken) =>
      requestParsed(adminPricePlanSchema, '/admin/price-plans', {
        method: 'POST',
        body: input,
        accessToken,
      }),

    updatePricePlan: (id, patch, accessToken) =>
      requestParsed(adminPricePlanSchema, rowPath('price-plans', id), {
        method: 'PATCH',
        body: patch,
        accessToken,
      }),

    async deletePricePlan(id, accessToken) {
      await request(rowPath('price-plans', id), { method: 'DELETE', accessToken });
    },

    getSiteTexts: (accessToken) =>
      requestParsed(siteTextListSchema, '/admin/site-texts', { accessToken }),

    uploadImage: (file, kind, accessToken) => {
      const form = new FormData();
      form.append('kind', kind);
      form.append('file', file);

      return requestParsed(uploadResultSchema, '/admin/uploads', {
        method: 'POST',
        form,
        accessToken,
      });
    },
  };
}

function teacherPath(teacherId: string): string {
  return `/admin/teachers/${encodeURIComponent(teacherId)}`;
}

function rowPath(collection: string, id: string): string {
  return `/admin/${collection}/${encodeURIComponent(id)}`;
}

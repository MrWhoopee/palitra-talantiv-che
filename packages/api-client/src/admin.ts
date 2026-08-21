import {
  adminAchievementListSchema,
  adminAchievementSchema,
  adminDirectionListSchema,
  adminDirectionSchema,
  adminGalleryItemListSchema,
  adminGalleryItemSchema,
  adminLocationListSchema,
  adminLocationSchema,
  adminPricePlanListSchema,
  adminPricePlanSchema,
  adminStudioEventListSchema,
  adminStudioEventSchema,
  adminTeacherListSchema,
  adminTeacherSchema,
  adminTestimonialListSchema,
  adminTestimonialSchema,
  siteSettingsSchema,
  siteTextListSchema,
  siteTextSchema,
  uploadResultSchema,
  type AchievementInput,
  type AchievementPatch,
  type AdminAchievement,
  type AdminDirection,
  type AdminGalleryItem,
  type AdminLocation,
  type AdminPricePlan,
  type AdminStudioEvent,
  type AdminTeacher,
  type AdminTestimonial,
  type DirectionInput,
  type DirectionPatch,
  type GalleryItemInput,
  type GalleryItemPatch,
  type LocationInput,
  type LocationPatch,
  type PricePlanInput,
  type PricePlanPatch,
  type SiteSettings,
  type SiteText,
  type SiteTextInput,
  type SiteTextKey,
  type StudioEventInput,
  type StudioEventPatch,
  type TeacherInvite,
  type TeacherPatch,
  type TestimonialInput,
  type TestimonialPatch,
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

  /** Drafts included - which is the whole difference from the public playbill. */
  getEvents(accessToken: string): Promise<AdminStudioEvent[]>;
  createEvent(input: StudioEventInput, accessToken: string): Promise<AdminStudioEvent>;
  updateEvent(id: string, patch: StudioEventPatch, accessToken: string): Promise<AdminStudioEvent>;
  deleteEvent(id: string, accessToken: string): Promise<void>;

  getGalleryItems(accessToken: string): Promise<AdminGalleryItem[]>;
  createGalleryItem(input: GalleryItemInput, accessToken: string): Promise<AdminGalleryItem>;
  updateGalleryItem(
    id: string,
    patch: GalleryItemPatch,
    accessToken: string,
  ): Promise<AdminGalleryItem>;
  /** Removes the row and, with it, the stored picture. */
  deleteGalleryItem(id: string, accessToken: string): Promise<void>;
  /**
   * The whole running order at once. Sending the arrangement rather than one
   * swap at a time means a screen that moved two photos cannot leave the list
   * half-reordered if the second request never arrives.
   */
  reorderGallery(ids: string[], accessToken: string): Promise<void>;

  getTestimonials(accessToken: string): Promise<AdminTestimonial[]>;
  createTestimonial(input: TestimonialInput, accessToken: string): Promise<AdminTestimonial>;
  updateTestimonial(
    id: string,
    patch: TestimonialPatch,
    accessToken: string,
  ): Promise<AdminTestimonial>;
  deleteTestimonial(id: string, accessToken: string): Promise<void>;

  getAchievements(accessToken: string): Promise<AdminAchievement[]>;
  createAchievement(input: AchievementInput, accessToken: string): Promise<AdminAchievement>;
  updateAchievement(
    id: string,
    patch: AchievementPatch,
    accessToken: string,
  ): Promise<AdminAchievement>;
  deleteAchievement(id: string, accessToken: string): Promise<void>;

  getSiteTexts(accessToken: string): Promise<SiteText[]>;
  /**
   * Written by key, never created with one: which pages exist is decided by
   * the web app's routes, so there is no call here that invents a page.
   */
  saveSiteText(key: SiteTextKey, input: SiteTextInput, accessToken: string): Promise<SiteText>;

  getSiteSettings(accessToken: string): Promise<SiteSettings>;
  /** A partial write: a key left out keeps its value, a key sent empty is cleared. */
  saveSiteSettings(input: SiteSettings, accessToken: string): Promise<SiteSettings>;

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

    getEvents: (accessToken) =>
      requestParsed(adminStudioEventListSchema, '/admin/events', { accessToken }),

    createEvent: (input, accessToken) =>
      requestParsed(adminStudioEventSchema, '/admin/events', {
        method: 'POST',
        body: input,
        accessToken,
      }),

    updateEvent: (id, patch, accessToken) =>
      requestParsed(adminStudioEventSchema, rowPath('events', id), {
        method: 'PATCH',
        body: patch,
        accessToken,
      }),

    async deleteEvent(id, accessToken) {
      await request(rowPath('events', id), { method: 'DELETE', accessToken });
    },

    getGalleryItems: (accessToken) =>
      requestParsed(adminGalleryItemListSchema, '/admin/gallery', { accessToken }),

    createGalleryItem: (input, accessToken) =>
      requestParsed(adminGalleryItemSchema, '/admin/gallery', {
        method: 'POST',
        body: input,
        accessToken,
      }),

    updateGalleryItem: (id, patch, accessToken) =>
      requestParsed(adminGalleryItemSchema, rowPath('gallery', id), {
        method: 'PATCH',
        body: patch,
        accessToken,
      }),

    async deleteGalleryItem(id, accessToken) {
      await request(rowPath('gallery', id), { method: 'DELETE', accessToken });
    },

    async reorderGallery(ids, accessToken) {
      await request('/admin/gallery/order', { method: 'PUT', body: { ids }, accessToken });
    },

    getTestimonials: (accessToken) =>
      requestParsed(adminTestimonialListSchema, '/admin/testimonials', { accessToken }),

    createTestimonial: (input, accessToken) =>
      requestParsed(adminTestimonialSchema, '/admin/testimonials', {
        method: 'POST',
        body: input,
        accessToken,
      }),

    updateTestimonial: (id, patch, accessToken) =>
      requestParsed(adminTestimonialSchema, rowPath('testimonials', id), {
        method: 'PATCH',
        body: patch,
        accessToken,
      }),

    async deleteTestimonial(id, accessToken) {
      await request(rowPath('testimonials', id), { method: 'DELETE', accessToken });
    },

    getAchievements: (accessToken) =>
      requestParsed(adminAchievementListSchema, '/admin/achievements', { accessToken }),

    createAchievement: (input, accessToken) =>
      requestParsed(adminAchievementSchema, '/admin/achievements', {
        method: 'POST',
        body: input,
        accessToken,
      }),

    updateAchievement: (id, patch, accessToken) =>
      requestParsed(adminAchievementSchema, rowPath('achievements', id), {
        method: 'PATCH',
        body: patch,
        accessToken,
      }),

    async deleteAchievement(id, accessToken) {
      await request(rowPath('achievements', id), { method: 'DELETE', accessToken });
    },

    getSiteTexts: (accessToken) =>
      requestParsed(siteTextListSchema, '/admin/site-texts', { accessToken }),

    saveSiteText: (key, input, accessToken) =>
      requestParsed(siteTextSchema, rowPath('site-texts', key), {
        method: 'PUT',
        body: input,
        accessToken,
      }),

    getSiteSettings: (accessToken) =>
      requestParsed(siteSettingsSchema, '/admin/site-settings', { accessToken }),

    saveSiteSettings: (input, accessToken) =>
      requestParsed(siteSettingsSchema, '/admin/site-settings', {
        method: 'PUT',
        body: input,
        accessToken,
      }),

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

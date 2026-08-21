import {
  adminTeacherListSchema,
  adminTeacherSchema,
  siteTextListSchema,
  uploadResultSchema,
  type AdminTeacher,
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

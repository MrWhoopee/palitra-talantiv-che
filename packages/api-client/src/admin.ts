import { adminTeacherListSchema, siteTextListSchema, type AdminTeacher, type SiteText } from '@palitra/shared';
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
  getSiteTexts(accessToken: string): Promise<SiteText[]>;
}

export function createAdminClient(options: ApiClientOptions): AdminClient {
  const { requestParsed } = createHttp(options);

  return {
    getTeachers: (accessToken) =>
      requestParsed(adminTeacherListSchema, '/admin/teachers', { accessToken }),

    getSiteTexts: (accessToken) =>
      requestParsed(siteTextListSchema, '/admin/site-texts', { accessToken }),
  };
}

import { siteSettingsSchema, siteTextInputSchema, siteTextKeySchema } from '@palitra/shared';
import { Router } from 'express';
import { DomainError } from '../../http/error-handler';
import { withBody } from '../../http/middleware/validate';
import type { SiteService } from './site.service';

export interface SiteAdminRouterDeps {
  site: SiteService;
}

/**
 * The writing half of the site copy.
 *
 * Reading is repeated here on the guarded prefix so that the admin screens
 * have one base address for everything they do, rather than half their
 * requests going to the public routes and half to these.
 *
 * Nothing here mentions the admin role. Every one of these paths is mounted
 * under `/admin`, which is where the guard lives.
 */
export function createSiteAdminRouter({ site }: SiteAdminRouterDeps): Router {
  const router = Router();

  router.get('/admin/site-texts', async (_req, res) => {
    res.status(200).json(await site.listTexts());
  });

  router.put(
    '/admin/site-texts/:key',
    withBody(siteTextInputSchema, async (input, req, res) => {
      const key = siteTextKeySchema.safeParse(req.params['key']);

      // A page the app does not have is a wrong address, not a bad field:
      // which pages exist is decided by the routes, and text filed under a
      // name nothing renders would simply never be seen.
      if (!key.success) {
        throw new DomainError('NOT_FOUND', 'Такої сторінки немає');
      }

      res.status(200).json(await site.saveText(key.data, input));
    }),
  );

  router.get('/admin/site-settings', async (_req, res) => {
    res.status(200).json(await site.getSettings());
  });

  router.put(
    '/admin/site-settings',
    withBody(siteSettingsSchema, async (input, _req, res) => {
      res.status(200).json(await site.saveSettings(input));
    }),
  );

  return router;
}

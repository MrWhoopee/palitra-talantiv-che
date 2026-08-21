import { Router } from 'express';
import type { SiteService } from './site.service';

export interface SiteRouterDeps {
  site: SiteService;
}

/**
 * Public and read-only, all of it: the copy and the contacts are rendered on
 * pages a visitor sees before signing in, and the footer is on every one of
 * them. Both lists are small and are asked for once per render, which is why
 * neither is paged.
 */
export function createSiteRouter({ site }: SiteRouterDeps): Router {
  const router = Router();

  router.get('/site-texts', async (_req, res) => {
    res.status(200).json(await site.listTexts());
  });

  router.get('/site-settings', async (_req, res) => {
    res.status(200).json(await site.getSettings());
  });

  return router;
}

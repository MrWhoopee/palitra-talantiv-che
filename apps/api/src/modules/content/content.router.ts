import { Router } from 'express';
import type { ContentService } from './content.service';

export interface ContentRouterDeps {
  content: ContentService;
}

/**
 * Public and read-only, all of it. Writing this content is the admin's job and
 * arrives with stage 6; until then the rows come from the seed.
 */
export function createContentRouter({ content }: ContentRouterDeps): Router {
  const router = Router();

  router.get('/events', async (req, res) => {
    const when = req.query['when'];
    res
      .status(200)
      .json(await content.listEvents(when === 'past' || when === 'all' ? when : 'upcoming'));
  });

  router.get('/events/:slug', async (req, res) => {
    res.status(200).json(await content.getEvent(String(req.params['slug'])));
  });

  router.get('/gallery', async (_req, res) => {
    res.status(200).json(await content.listGallery());
  });

  router.get('/testimonials', async (_req, res) => {
    res.status(200).json(await content.listTestimonials());
  });

  router.get('/achievements', async (_req, res) => {
    res.status(200).json(await content.listAchievements());
  });

  return router;
}

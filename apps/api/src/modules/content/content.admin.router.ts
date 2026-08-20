import {
  achievementInputSchema,
  achievementPatchSchema,
  galleryItemInputSchema,
  galleryItemPatchSchema,
  sortOrderInputSchema,
  studioEventInputSchema,
  studioEventPatchSchema,
  testimonialInputSchema,
  testimonialPatchSchema,
} from '@palitra/shared';
import { Router } from 'express';
import { withBody } from '../../http/middleware/validate';
import type { StorageAdapter } from '../../lib/storage';
import type { ContentService } from './content.service';

export interface ContentAdminRouterDeps {
  content: ContentService;
  storage: StorageAdapter;
}

/**
 * The writing half of the content module.
 *
 * A separate file from `content.router.ts` rather than more routes inside it:
 * that file's whole contract is that it is public and read-only, and a `POST`
 * in the middle of it would make the promise in its header a lie. The service
 * behind both is one, because both halves are the same tables.
 *
 * Nothing here mentions the admin role. Every one of these paths is mounted
 * under `/admin`, which is where the guard lives.
 */
export function createContentAdminRouter({ content, storage }: ContentAdminRouterDeps): Router {
  const router = Router();

  router.get('/admin/events', async (_req, res) => {
    res.status(200).json(await content.listAllEvents());
  });

  router.post(
    '/admin/events',
    withBody(studioEventInputSchema, async (input, _req, res) => {
      res.status(201).json(await content.createEvent(input));
    }),
  );

  router.patch(
    '/admin/events/:id',
    withBody(studioEventPatchSchema, async (patch, req, res) => {
      res.status(200).json(await content.updateEvent(String(req.params['id']), patch));
    }),
  );

  router.delete('/admin/events/:id', async (req, res) => {
    await content.deleteEvent(String(req.params['id']));
    res.status(204).end();
  });

  router.get('/admin/gallery', async (_req, res) => {
    res.status(200).json(await content.listAllGallery());
  });

  router.post(
    '/admin/gallery',
    withBody(galleryItemInputSchema, async (input, _req, res) => {
      res.status(201).json(await content.createGalleryItem(input));
    }),
  );

  router.put(
    '/admin/gallery/order',
    withBody(sortOrderInputSchema, async ({ ids }, _req, res) => {
      await content.reorderGallery(ids);
      res.status(204).end();
    }),
  );

  router.patch(
    '/admin/gallery/:id',
    withBody(galleryItemPatchSchema, async (patch, req, res) => {
      res.status(200).json(await content.updateGalleryItem(String(req.params['id']), patch));
    }),
  );

  router.delete('/admin/gallery/:id', async (req, res) => {
    const orphaned = await content.deleteGalleryItem(String(req.params['id']));

    // Best effort, and after the row is already gone: a picture the storage
    // could not delete is wasted space, while a failure raised here would be
    // a 500 for a deletion that did happen.
    await Promise.all(orphaned.map((url) => storage.remove(url).catch(logRemovalFailure(url))));

    res.status(204).end();
  });

  router.get('/admin/testimonials', async (_req, res) => {
    res.status(200).json(await content.listAllTestimonials());
  });

  router.post(
    '/admin/testimonials',
    withBody(testimonialInputSchema, async (input, _req, res) => {
      res.status(201).json(await content.createTestimonial(input));
    }),
  );

  router.patch(
    '/admin/testimonials/:id',
    withBody(testimonialPatchSchema, async (patch, req, res) => {
      res.status(200).json(await content.updateTestimonial(String(req.params['id']), patch));
    }),
  );

  router.delete('/admin/testimonials/:id', async (req, res) => {
    await content.deleteTestimonial(String(req.params['id']));
    res.status(204).end();
  });

  router.get('/admin/achievements', async (_req, res) => {
    res.status(200).json(await content.listAllAchievements());
  });

  router.post(
    '/admin/achievements',
    withBody(achievementInputSchema, async (input, _req, res) => {
      res.status(201).json(await content.createAchievement(input));
    }),
  );

  router.patch(
    '/admin/achievements/:id',
    withBody(achievementPatchSchema, async (patch, req, res) => {
      res.status(200).json(await content.updateAchievement(String(req.params['id']), patch));
    }),
  );

  router.delete('/admin/achievements/:id', async (req, res) => {
    await content.deleteAchievement(String(req.params['id']));
    res.status(204).end();
  });

  return router;
}

function logRemovalFailure(url: string): (error: unknown) => void {
  return (error) => console.error(`Failed to remove ${url} from storage`, error);
}

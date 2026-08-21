import {
  directionInputSchema,
  directionPatchSchema,
  locationInputSchema,
  locationPatchSchema,
  pricePlanInputSchema,
  pricePlanPatchSchema,
  teacherInviteSchema,
  teacherLinksSchema,
  teacherPatchSchema,
} from '@palitra/shared';
import { Router } from 'express';
import { pathUuid, withBody } from '../../http/middleware/validate';
import type { TeachersService } from './teachers.service';

export interface TeachersAdminRouterDeps {
  teachers: TeachersService;
}

/**
 * The studio's own view of its staff: everyone, including the drafts and the
 * people who have left, with the way to reach them.
 *
 * A separate file from `teachers.router.ts` for the same reason the content
 * module is split - that file's promise is that all of it is public, and one
 * `POST` in the middle of it would make that promise untrue.
 *
 * Nothing here mentions the admin role. Every one of these paths is mounted
 * under `/admin`, which is where the guard lives.
 */
export function createTeachersAdminRouter({ teachers }: TeachersAdminRouterDeps): Router {
  const router = Router();

  router.get('/admin/teachers', async (_req, res) => {
    res.status(200).json(await teachers.listAllTeachers());
  });

  router.post(
    '/admin/teachers',
    withBody(teacherInviteSchema, async (input, _req, res) => {
      res.status(201).json(await teachers.inviteTeacher(input));
    }),
  );

  router.get('/admin/teachers/:id', async (req, res) => {
    res.status(200).json(await teachers.getTeacherForAdmin(pathUuid(req, 'id')));
  });

  router.patch(
    '/admin/teachers/:id',
    withBody(teacherPatchSchema, async (patch, req, res) => {
      res.status(200).json(await teachers.updateTeacher(pathUuid(req, 'id'), patch));
    }),
  );

  router.put(
    '/admin/teachers/:id/directions',
    withBody(teacherLinksSchema, async ({ ids }, req, res) => {
      res.status(200).json(await teachers.setTeacherDirections(pathUuid(req, 'id'), ids));
    }),
  );

  router.put(
    '/admin/teachers/:id/locations',
    withBody(teacherLinksSchema, async ({ ids }, req, res) => {
      res.status(200).json(await teachers.setTeacherLocations(pathUuid(req, 'id'), ids));
    }),
  );

  router.post('/admin/teachers/:id/reinvite', async (req, res) => {
    await teachers.reinviteTeacher(pathUuid(req, 'id'));
    res.status(204).end();
  });

  // The reference tables the public router serves read-only, here with the
  // ordering, the retired price plans, and the four verbs that write them.

  router.get('/admin/locations', async (_req, res) => {
    res.status(200).json(await teachers.listAllLocations());
  });

  router.post(
    '/admin/locations',
    withBody(locationInputSchema, async (input, _req, res) => {
      res.status(201).json(await teachers.createLocation(input));
    }),
  );

  router.patch(
    '/admin/locations/:id',
    withBody(locationPatchSchema, async (patch, req, res) => {
      res.status(200).json(await teachers.updateLocation(pathUuid(req, 'id'), patch));
    }),
  );

  router.delete('/admin/locations/:id', async (req, res) => {
    await teachers.deleteLocation(pathUuid(req, 'id'));
    res.status(204).end();
  });

  router.get('/admin/directions', async (_req, res) => {
    res.status(200).json(await teachers.listAllDirections());
  });

  router.post(
    '/admin/directions',
    withBody(directionInputSchema, async (input, _req, res) => {
      res.status(201).json(await teachers.createDirection(input));
    }),
  );

  router.patch(
    '/admin/directions/:id',
    withBody(directionPatchSchema, async (patch, req, res) => {
      res.status(200).json(await teachers.updateDirection(pathUuid(req, 'id'), patch));
    }),
  );

  router.delete('/admin/directions/:id', async (req, res) => {
    await teachers.deleteDirection(pathUuid(req, 'id'));
    res.status(204).end();
  });

  router.get('/admin/price-plans', async (_req, res) => {
    res.status(200).json(await teachers.listAllPricePlans());
  });

  router.post(
    '/admin/price-plans',
    withBody(pricePlanInputSchema, async (input, _req, res) => {
      res.status(201).json(await teachers.createPricePlan(input));
    }),
  );

  router.patch(
    '/admin/price-plans/:id',
    withBody(pricePlanPatchSchema, async (patch, req, res) => {
      res.status(200).json(await teachers.updatePricePlan(pathUuid(req, 'id'), patch));
    }),
  );

  router.delete('/admin/price-plans/:id', async (req, res) => {
    await teachers.deletePricePlan(pathUuid(req, 'id'));
    res.status(204).end();
  });

  return router;
}

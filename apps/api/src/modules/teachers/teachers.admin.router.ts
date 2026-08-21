import { teacherInviteSchema, teacherLinksSchema, teacherPatchSchema } from '@palitra/shared';
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

  return router;
}

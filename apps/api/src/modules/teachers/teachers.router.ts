import { Router } from 'express';
import { pathUuid } from '../../http/middleware/validate';
import type { TeachersService } from './teachers.service';

export interface TeachersRouterDeps {
  teachers: TeachersService;
}

/**
 * All of this is public: the site has to render the teacher cards and the
 * price page for a visitor who has never signed in, and the mobile client
 * shows the same lists before login.
 */
export function createTeachersRouter({ teachers }: TeachersRouterDeps): Router {
  const router = Router();

  router.get('/teachers', async (_req, res) => {
    res.status(200).json(await teachers.listTeachers());
  });

  router.get('/teachers/:id', async (req, res) => {
    res.status(200).json(await teachers.getTeacher(pathUuid(req, 'id')));
  });

  router.get('/locations', async (_req, res) => {
    res.status(200).json(await teachers.listLocations());
  });

  router.get('/directions', async (_req, res) => {
    res.status(200).json(await teachers.listDirections());
  });

  return router;
}

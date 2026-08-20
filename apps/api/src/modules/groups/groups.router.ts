import { attendanceUpdateSchema, groupInputSchema } from '@palitra/shared';
import { Router } from 'express';
import { actorOf } from '../../http/actor';
import { createRequireAuth, requireRole } from '../../http/middleware/auth';
import { pathUuid, withBody } from '../../http/middleware/validate';
import type { AccessTokenService } from '../../lib/access-token';
import type { GroupsService } from './groups.service';

export interface GroupsRouterDeps {
  groups: GroupsService;
  accessTokens: AccessTokenService;
}

/**
 * The open groups are public - a parent reads the timetable before creating an
 * account. Everything that changes a group is behind a teacher or an admin,
 * and the service decides *which* teacher, because a role cannot tell one
 * teacher's group from another's.
 */
export function createGroupsRouter({ groups, accessTokens }: GroupsRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(accessTokens);
  const requireTeacher = requireRole('TEACHER', 'ADMIN');

  router.get('/groups', async (_req, res) => {
    res.status(200).json(await groups.listOpen());
  });

  // Before `/groups/:id`, or "mine" would be read as a group id.
  router.get('/me/groups', requireAuth, async (req, res) => {
    res.status(200).json(await groups.listForActor(actorOf(req)));
  });

  router.get('/me/lessons/:id/attendance', requireAuth, requireTeacher, async (req, res) => {
    res.status(200).json(await groups.getAttendance(actorOf(req), pathUuid(req, 'id')));
  });

  router.put(
    '/me/lessons/:id/attendance',
    requireAuth,
    requireTeacher,
    withBody(attendanceUpdateSchema, async (input, req, res) => {
      res.status(200).json(await groups.setAttendance(actorOf(req), pathUuid(req, 'id'), input));
    }),
  );

  router.get('/groups/:id', async (req, res) => {
    res.status(200).json(await groups.get(pathUuid(req, 'id')));
  });

  router.post(
    '/groups',
    requireAuth,
    requireTeacher,
    withBody(groupInputSchema, async (input, req, res) => {
      res.status(201).json(await groups.create(actorOf(req), input));
    }),
  );

  router.put(
    '/groups/:id',
    requireAuth,
    requireTeacher,
    withBody(groupInputSchema, async (input, req, res) => {
      res.status(200).json(await groups.update(actorOf(req), pathUuid(req, 'id'), input));
    }),
  );

  router.get('/groups/:id/enrollments', requireAuth, requireTeacher, async (req, res) => {
    res.status(200).json(await groups.listEnrollments(actorOf(req), pathUuid(req, 'id')));
  });

  router.post('/groups/:id/enrollments', requireAuth, async (req, res) => {
    res.status(201).json(await groups.apply(actorOf(req), pathUuid(req, 'id')));
  });

  router.post(
    '/groups/:id/enrollments/:enrollmentId/approve',
    requireAuth,
    requireTeacher,
    async (req, res) => {
      res.status(200).json(await groups.approve(actorOf(req), pathUuid(req, 'enrollmentId')));
    },
  );

  // Not restricted to teachers: the same call is how a student withdraws, and
  // the service is what tells the two cases apart.
  router.post('/groups/:id/enrollments/:enrollmentId/remove', requireAuth, async (req, res) => {
    res.status(200).json(await groups.remove(actorOf(req), pathUuid(req, 'enrollmentId')));
  });

  return router;
}

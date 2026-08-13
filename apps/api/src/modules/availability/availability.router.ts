import {
  availabilityExceptionInputSchema,
  availabilityRuleInputSchema,
  slotQuerySchema,
} from '@palitra/shared';
import { Router, type Request } from 'express';
import { DomainError } from '../../http/error-handler';
import { createRequireAuth } from '../../http/middleware/auth';
import { pathUuid, withBody, withQuery } from '../../http/middleware/validate';
import type { AccessTokenService } from '../../lib/access-token';
import type { AvailabilityService } from './availability.service';

export interface AvailabilityRouterDeps {
  availability: AvailabilityService;
  accessTokens: AccessTokenService;
}

/**
 * Reading free slots is public - a visitor picks an hour before creating an
 * account. Everything under `/availability` belongs to the teacher whose id is
 * in the path, and only that teacher or an admin may touch it.
 */
export function createAvailabilityRouter({
  availability,
  accessTokens,
}: AvailabilityRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(accessTokens);

  router.get(
    '/teachers/:id/slots',
    withQuery(slotQuerySchema, async (query, req, res) => {
      res.status(200).json(await availability.getSlots(pathUuid(req, 'id'), query));
    }),
  );

  router.get('/teachers/:id/availability/rules', requireAuth, async (req, res) => {
    const teacherId = ownedTeacherId(req);
    res.status(200).json(await availability.listRules(teacherId));
  });

  router.post(
    '/teachers/:id/availability/rules',
    requireAuth,
    withBody(availabilityRuleInputSchema, async (input, req, res) => {
      res.status(201).json(await availability.createRule(ownedTeacherId(req), input));
    }),
  );

  router.put(
    '/teachers/:id/availability/rules/:ruleId',
    requireAuth,
    withBody(availabilityRuleInputSchema, async (input, req, res) => {
      const teacherId = ownedTeacherId(req);
      res
        .status(200)
        .json(await availability.updateRule(teacherId, pathUuid(req, 'ruleId'), input));
    }),
  );

  router.delete('/teachers/:id/availability/rules/:ruleId', requireAuth, async (req, res) => {
    const teacherId = ownedTeacherId(req);
    await availability.deleteRule(teacherId, pathUuid(req, 'ruleId'));
    res.status(204).end();
  });

  router.get('/teachers/:id/availability/exceptions', requireAuth, async (req, res) => {
    res.status(200).json(await availability.listExceptions(ownedTeacherId(req)));
  });

  router.post(
    '/teachers/:id/availability/exceptions',
    requireAuth,
    withBody(availabilityExceptionInputSchema, async (input, req, res) => {
      res.status(201).json(await availability.createException(ownedTeacherId(req), input));
    }),
  );

  router.delete(
    '/teachers/:id/availability/exceptions/:exceptionId',
    requireAuth,
    async (req, res) => {
      const teacherId = ownedTeacherId(req);
      await availability.deleteException(teacherId, pathUuid(req, 'exceptionId'));
      res.status(204).end();
    },
  );

  return router;
}

/**
 * The ownership half of the permission check, and the important half: a role
 * alone cannot tell teacher A's schedule from teacher B's, so without this a
 * teacher would edit a colleague's working hours by putting their id in the
 * path. Admins are exempt by design - the matrix in the spec gives them every
 * schedule.
 */
function ownedTeacherId(req: Request): string {
  const teacherId = pathUuid(req, 'id');

  if (!req.auth) {
    throw new DomainError('UNAUTHENTICATED', 'Потрібна авторизація');
  }

  if (req.auth.role !== 'ADMIN' && req.auth.userId !== teacherId) {
    throw new DomainError('NOT_TEACHER_OWNED', 'Це розклад іншого викладача');
  }

  return teacherId;
}

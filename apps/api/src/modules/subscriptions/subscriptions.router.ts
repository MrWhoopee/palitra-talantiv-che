import { subscriptionInputSchema } from '@palitra/shared';
import { Router } from 'express';
import { actorOf } from '../../http/actor';
import { createRequireAuth, requireRole } from '../../http/middleware/auth';
import { pathUuid, withBody } from '../../http/middleware/validate';
import type { AccessTokenService } from '../../lib/access-token';
import type { SubscriptionService } from './subscriptions.service';

export interface SubscriptionsRouterDeps {
  subscriptions: SubscriptionService;
  accessTokens: AccessTokenService;
}

/**
 * Issuing and paying for a package are the studio's business, so they sit
 * behind `requireRole('ADMIN')`. Reading is open to everyone signed in and the
 * service narrows the rows to what the caller is entitled to see - a role
 * cannot tell one student's packages from another's.
 */
export function createSubscriptionsRouter({
  subscriptions,
  accessTokens,
}: SubscriptionsRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(accessTokens);
  const requireAdmin = requireRole('ADMIN');

  router.get('/me/subscriptions', requireAuth, async (req, res) => {
    res.status(200).json(await subscriptions.listFor(actorOf(req)));
  });

  router.post(
    '/subscriptions',
    requireAuth,
    requireAdmin,
    withBody(subscriptionInputSchema, async (input, _req, res) => {
      res.status(201).json(await subscriptions.issue(input));
    }),
  );

  router.post('/subscriptions/:id/paid', requireAuth, requireAdmin, async (req, res) => {
    res.status(200).json(await subscriptions.markPaid(pathUuid(req, 'id')));
  });

  router.post('/subscriptions/:id/cancel', requireAuth, requireAdmin, async (req, res) => {
    res.status(200).json(await subscriptions.cancel(pathUuid(req, 'id')));
  });

  return router;
}

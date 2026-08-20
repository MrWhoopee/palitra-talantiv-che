import { Router } from 'express';
import { createRequireAuth, requireRole } from '../../http/middleware/auth';
import type { AccessTokenService } from '../../lib/access-token';

export const ADMIN_PREFIX = '/admin';

export interface AdminRouterDeps {
  accessTokens: AccessTokenService;
  /**
   * The admin-facing routers of the feature modules. They arrive already built
   * and declare their own full paths, so this file knows nothing about events,
   * teachers or price plans - it knows only that everything under `/admin`
   * belongs to an admin.
   */
  routers: readonly Router[];
}

/**
 * One guard for the whole admin surface.
 *
 * The alternative was `requireRole('ADMIN')` on each individual route, and the
 * problem with it is not that it is verbose: it is that forgetting it on one
 * route out of thirty leaves a hole that reads exactly like the rest of the
 * file. Here the guard is attached to the prefix, so a new admin route is
 * protected by existing, not by being remembered.
 *
 * The prefix is what scopes it. Mounting the middleware without a path would
 * make it run for every request that reaches this router on its way to the
 * next one, and the public site would start asking visitors to sign in.
 */
export function createAdminRouter({ accessTokens, routers }: AdminRouterDeps): Router {
  const router = Router();

  router.use(ADMIN_PREFIX, createRequireAuth(accessTokens), requireRole('ADMIN'));

  for (const mounted of routers) {
    router.use(mounted);
  }

  return router;
}

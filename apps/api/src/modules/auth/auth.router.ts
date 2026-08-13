import {
  loginRequestSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  refreshRequestSchema,
  registerRequestSchema,
  verifyEmailRequestSchema,
} from '@palitra/shared';
import { Router } from 'express';
import type { Request, RequestHandler } from 'express';
import type { AccessTokenService } from '../../lib/access-token';
import { createRequireAuth } from '../../http/middleware/auth';
import { withBody } from '../../http/middleware/validate';
import { DomainError } from '../../http/error-handler';
import { createAuthRateLimiter } from './auth.rate-limit';
import type { AuthService, SessionMeta } from './auth.service';

export interface AuthRouterDeps {
  auth: AuthService;
  accessTokens: AccessTokenService;
  /** Injected so tests can opt out of throttling; production takes the default. */
  rateLimit?: RequestHandler;
}

export function createAuthRouter({
  auth,
  accessTokens,
  rateLimit = createAuthRateLimiter(),
}: AuthRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(accessTokens);

  router.post(
    '/auth/register',
    rateLimit,
    withBody(registerRequestSchema, async (input, req, res) => {
      res.status(201).json(await auth.register(input, sessionMeta(req)));
    }),
  );

  router.post(
    '/auth/login',
    rateLimit,
    withBody(loginRequestSchema, async (input, req, res) => {
      res.status(200).json(await auth.login(input, sessionMeta(req)));
    }),
  );

  router.post(
    '/auth/refresh',
    withBody(refreshRequestSchema, async ({ refreshToken }, req, res) => {
      res.status(200).json(await auth.refresh(refreshToken, sessionMeta(req)));
    }),
  );

  router.post(
    '/auth/logout',
    withBody(refreshRequestSchema, async ({ refreshToken }, _req, res) => {
      await auth.logout(refreshToken);
      res.status(204).end();
    }),
  );

  router.post(
    '/auth/verify-email',
    withBody(verifyEmailRequestSchema, async ({ token }, _req, res) => {
      res.status(200).json(await auth.verifyEmail(token));
    }),
  );

  router.post(
    '/auth/password-reset/request',
    rateLimit,
    withBody(passwordResetRequestSchema, async ({ email }, _req, res) => {
      await auth.requestPasswordReset(email);
      // 202, and the same answer whether or not the address is known: a 404
      // here would tell anyone which emails belong to studio clients.
      res.status(202).end();
    }),
  );

  router.post(
    '/auth/password-reset/confirm',
    rateLimit,
    withBody(passwordResetSchema, async ({ token, password }, _req, res) => {
      await auth.resetPassword(token, password);
      res.status(204).end();
    }),
  );

  router.get('/auth/me', requireAuth, async (req, res) => {
    if (!req.auth) {
      throw new DomainError('UNAUTHENTICATED', 'Потрібна авторизація');
    }
    res.status(200).json(await auth.getUser(req.auth.userId));
  });

  return router;
}

function sessionMeta(req: Request): SessionMeta {
  const userAgent = req.headers['user-agent'];
  return { userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 255) : undefined };
}

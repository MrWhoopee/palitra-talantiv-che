import type { UserRole } from '@palitra/shared';
import type { RequestHandler } from 'express';
import type { AccessTokenClaims, AccessTokenService } from '../../lib/access-token';
import { DomainError } from '../error-handler';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /**
       * Named `auth` rather than `user` to keep it obviously distinct from a
       * loaded `User` row: these are token claims, not a database record, and
       * the role in them can be one revision behind the database.
       */
      auth?: AccessTokenClaims;
    }
  }
}

const BEARER = 'Bearer ';

export function createRequireAuth(accessTokens: AccessTokenService): RequestHandler {
  return async (req, _res, next) => {
    const header = req.headers.authorization;
    const token = header?.startsWith(BEARER) ? header.slice(BEARER.length).trim() : '';
    const claims = token ? await accessTokens.verify(token) : null;

    if (!claims) {
      next(new DomainError('UNAUTHENTICATED', 'Потрібна авторизація'));
      return;
    }

    req.auth = claims;
    next();
  };
}

/**
 * The coarse half of the permission check. Ownership ("is this *your* lesson")
 * is decided in the services, because a role alone cannot tell teacher A's
 * rows from teacher B's.
 */
export function requireRole(...roles: readonly UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new DomainError('UNAUTHENTICATED', 'Потрібна авторизація'));
      return;
    }

    if (!roles.includes(req.auth.role)) {
      next(new DomainError('FORBIDDEN', 'Недостатньо прав'));
      return;
    }

    next();
  };
}

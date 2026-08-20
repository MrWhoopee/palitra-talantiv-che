import type { UserRole } from '@palitra/shared';
import type { Request } from 'express';
import { DomainError } from './error-handler';

/** Who is asking. The role comes from the token, the id from the same claims. */
export interface Actor {
  userId: string;
  role: UserRole;
}

/**
 * Every authenticated handler needs the same two claims, and reading them from
 * `req.auth` in each router invited a third copy with a subtly different
 * fallback. The throw is unreachable behind `requireAuth` and is here so the
 * type is not optional for the services below it.
 */
export function actorOf(req: Request): Actor {
  if (!req.auth) {
    throw new DomainError('UNAUTHENTICATED', 'Потрібна авторизація');
  }
  return { userId: req.auth.userId, role: req.auth.role };
}

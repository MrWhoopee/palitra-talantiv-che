import { bookingRequestSchema, cancelLessonSchema } from '@palitra/shared';
import { Router, type Request } from 'express';
import { DomainError } from '../../http/error-handler';
import { createRequireAuth } from '../../http/middleware/auth';
import { pathUuid, withBody } from '../../http/middleware/validate';
import type { AccessTokenService } from '../../lib/access-token';
import type { Actor, BookingService } from './booking.service';

export interface BookingRouterDeps {
  booking: BookingService;
  accessTokens: AccessTokenService;
}

export function createBookingRouter({ booking, accessTokens }: BookingRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(accessTokens);

  router.post(
    '/bookings',
    requireAuth,
    withBody(bookingRequestSchema, async (input, req, res) => {
      res.status(201).json(await booking.book(actorOf(req), input));
    }),
  );

  router.get('/me/lessons', requireAuth, async (req, res) => {
    res.status(200).json(await booking.listMyLessons(actorOf(req).userId));
  });

  router.post('/lessons/:id/confirm', requireAuth, async (req, res) => {
    res.status(200).json(await booking.confirm(actorOf(req), pathUuid(req, 'id')));
  });

  router.post(
    '/lessons/:id/cancel',
    requireAuth,
    withBody(cancelLessonSchema, async (input, req, res) => {
      res.status(200).json(await booking.cancel(actorOf(req), pathUuid(req, 'id'), input.reason));
    }),
  );

  router.post('/lessons/:id/complete', requireAuth, async (req, res) => {
    res.status(200).json(await booking.markOutcome(actorOf(req), pathUuid(req, 'id'), 'COMPLETED'));
  });

  router.post('/lessons/:id/no-show', requireAuth, async (req, res) => {
    res.status(200).json(await booking.markOutcome(actorOf(req), pathUuid(req, 'id'), 'NO_SHOW'));
  });

  return router;
}

function actorOf(req: Request): Actor {
  if (!req.auth) {
    throw new DomainError('UNAUTHENTICATED', 'Потрібна авторизація');
  }
  return { userId: req.auth.userId, role: req.auth.role };
}

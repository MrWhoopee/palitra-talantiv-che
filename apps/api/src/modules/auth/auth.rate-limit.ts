import type { ApiError } from '@palitra/shared';
import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 20;

/**
 * bcrypt at cost 12 already limits guessing to a couple of attempts per second
 * per connection, but nothing stops an attacker from opening a thousand
 * connections. The same limiter also caps password-reset requests, which would
 * otherwise let anyone use the studio's mail server to flood an inbox.
 *
 * The ceiling is set for humans in a shared network (a school, a family behind
 * one NAT), not for a single person: 20 attempts per quarter hour is generous
 * for anyone who simply mistyped a password and still useless for a dictionary.
 */
export function createAuthRateLimiter(): RequestHandler {
  const body: ApiError = {
    code: 'TOO_MANY_REQUESTS',
    message: 'Забагато спроб. Спробуйте за кілька хвилин.',
  };

  return rateLimit({
    windowMs: WINDOW_MINUTES * 60 * 1000,
    limit: MAX_ATTEMPTS,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: body,
  });
}

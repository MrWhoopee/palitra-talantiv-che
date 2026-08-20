import { z } from 'zod';

export const DOMAIN_ERROR_CODES = [
  'SLOT_TAKEN',
  'TRIAL_ALREADY_USED',
  'TOO_LATE_TO_CANCEL',
  'SUBSCRIPTION_EXHAUSTED',
  'GROUP_FULL',
  'ALREADY_ENROLLED',
  'NO_ACTIVE_SUBSCRIPTION',
  'OUTSIDE_BOOKING_HORIZON',
  'NOT_TEACHER_OWNED',
  'EMAIL_NOT_VERIFIED',
  'INVALID_LESSON_STATUS',
  'EMAIL_TAKEN',
  'INVALID_CREDENTIALS',
  'INVALID_TOKEN',
  'TOO_MANY_REQUESTS',
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'INTERNAL_ERROR',
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export const DOMAIN_ERROR_STATUS: Record<DomainErrorCode, number> = {
  SLOT_TAKEN: 409,
  TRIAL_ALREADY_USED: 409,
  TOO_LATE_TO_CANCEL: 422,
  SUBSCRIPTION_EXHAUSTED: 409,
  GROUP_FULL: 409,
  ALREADY_ENROLLED: 409,
  NO_ACTIVE_SUBSCRIPTION: 409,
  OUTSIDE_BOOKING_HORIZON: 422,
  NOT_TEACHER_OWNED: 403,
  EMAIL_NOT_VERIFIED: 403,
  INVALID_LESSON_STATUS: 422,
  EMAIL_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  INVALID_TOKEN: 401,
  TOO_MANY_REQUESTS: 429,
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  INTERNAL_ERROR: 500,
};

export const apiErrorSchema = z.object({
  code: z.enum(DOMAIN_ERROR_CODES),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

/**
 * A transport-layer failure - the response could not be understood as a
 * domain error at all (e.g. its body doesn't match the expected schema).
 * Deliberately not part of DOMAIN_ERROR_CODES: it does not come from the
 * API's error envelope, has no HTTP status mapping, and must never appear
 * in DOMAIN_ERROR_STATUS.
 */
export const BAD_RESPONSE_CODE = 'BAD_RESPONSE' as const;

export type BadResponseCode = typeof BAD_RESPONSE_CODE;

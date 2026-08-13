import { z } from 'zod';

export const DOMAIN_ERROR_CODES = [
  'SLOT_TAKEN',
  'TRIAL_ALREADY_USED',
  'TOO_LATE_TO_CANCEL',
  'SUBSCRIPTION_EXHAUSTED',
  'GROUP_FULL',
  'OUTSIDE_BOOKING_HORIZON',
  'NOT_TEACHER_OWNED',
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
  OUTSIDE_BOOKING_HORIZON: 422,
  NOT_TEACHER_OWNED: 403,
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

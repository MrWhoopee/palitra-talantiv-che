import { DOMAIN_ERROR_STATUS, type ApiError, type DomainErrorCode } from '@palitra/shared';
import type { ErrorRequestHandler } from 'express';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: unknown;

  constructor(code: DomainErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

interface ExposedClientError {
  status: number;
  expose: true;
  message: string;
}

/**
 * body-parser (malformed JSON, oversized payloads, ...) raises errors with
 * a numeric `status` in the 4xx range and `expose: true` - it has already
 * classified these as the client's fault and marked the message safe to
 * return as-is. Anything else (a rejecting database query, a bug) does not
 * carry this shape and falls through to the generic 500 branch below.
 */
function isExposedClientError(err: unknown): err is ExposedClientError {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const candidate = err as { status?: unknown; expose?: unknown; message?: unknown };
  return (
    candidate.expose === true &&
    typeof candidate.status === 'number' &&
    candidate.status >= 400 &&
    candidate.status < 500 &&
    typeof candidate.message === 'string'
  );
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof DomainError) {
    const body: ApiError = { code: err.code, message: err.message };
    if (err.details !== undefined) {
      body.details = err.details;
    }
    res.status(DOMAIN_ERROR_STATUS[err.code]).json(body);
    return;
  }

  if (isExposedClientError(err)) {
    // Both a malformed JSON body and an oversized one are the client
    // sending a request we cannot accept as-is; neither has a dedicated
    // domain code, and VALIDATION_FAILED already means exactly this -
    // "what you sent does not meet our input constraints" - regardless of
    // which constraint (syntax vs. size) was violated. Deliberately not
    // logged at error level: this is routine client noise, not a server
    // fault, and the underlying error may carry the raw request body,
    // which must never reach the log.
    const body: ApiError = { code: 'VALIDATION_FAILED', message: err.message };
    res.status(err.status).json(body);
    return;
  }

  console.error('Unhandled error', err);

  const body: ApiError = { code: 'INTERNAL_ERROR', message: 'Unexpected server error' };
  res.status(DOMAIN_ERROR_STATUS.INTERNAL_ERROR).json(body);
};

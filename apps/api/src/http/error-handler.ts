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

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof DomainError) {
    const body: ApiError = { code: err.code, message: err.message };
    if (err.details !== undefined) {
      body.details = err.details;
    }
    res.status(DOMAIN_ERROR_STATUS[err.code]).json(body);
    return;
  }

  console.error('Unhandled error', err);

  const body: ApiError = { code: 'INTERNAL_ERROR', message: 'Unexpected server error' };
  res.status(DOMAIN_ERROR_STATUS.INTERNAL_ERROR).json(body);
};

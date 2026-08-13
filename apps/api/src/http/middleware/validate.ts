import type { Request, RequestHandler, Response } from 'express';
import { flattenError, type ZodType } from 'zod';
import { DomainError } from '../error-handler';

export type ValidatedHandler<T> = (input: T, req: Request, res: Response) => Promise<void> | void;

/**
 * Validation and the handler are one unit rather than two pieces of a chain:
 * a separate `validate` middleware would leave `req.body` typed as `any` for
 * whatever runs next, so every handler would start with a cast that TypeScript
 * cannot check. Here the handler receives the parsed value directly - with the
 * schema's normalisation (lower-cased email, trimmed names) already applied.
 */
export function withBody<T>(schema: ZodType<T>, handler: ValidatedHandler<T>): RequestHandler {
  return async (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(
        new DomainError(
          'VALIDATION_FAILED',
          'Перевірте заповнені поля',
          flattenError(result.error).fieldErrors,
        ),
      );
      return;
    }

    await handler(result.data, req, res);
  };
}

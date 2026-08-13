import type { Request, RequestHandler, Response } from 'express';
import { flattenError, z, type ZodType } from 'zod';
import { DomainError } from '../error-handler';

export type ValidatedHandler<T> = (input: T, req: Request, res: Response) => Promise<void> | void;

function validationError(error: z.ZodError): DomainError {
  return new DomainError(
    'VALIDATION_FAILED',
    'Перевірте заповнені поля',
    flattenError(error).fieldErrors,
  );
}

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
      next(validationError(result.error));
      return;
    }

    await handler(result.data, req, res);
  };
}

/** The same idea for the query string, where every value arrives as text. */
export function withQuery<T>(schema: ZodType<T>, handler: ValidatedHandler<T>): RequestHandler {
  return async (req, res, next) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      next(validationError(result.error));
      return;
    }

    await handler(result.data, req, res);
  };
}

const uuidSchema = z.uuid();

/**
 * A path segment that is not a uuid cannot name a row we have, so it is a 404
 * rather than a 400: "/teachers/banana" is a wrong address, not a malformed
 * field, and answering 400 would tell a scanner that the route exists.
 */
export function pathUuid(req: Request, name: string): string {
  const value = req.params[name];
  const result = uuidSchema.safeParse(value);

  if (!result.success) {
    throw new DomainError('NOT_FOUND', 'Не знайдено');
  }
  return result.data;
}

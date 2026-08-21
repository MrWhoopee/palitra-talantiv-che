import { apiErrorSchema, BAD_RESPONSE_CODE, type BadResponseCode, type DomainErrorCode } from '@palitra/shared';
import type { ZodType } from 'zod';

/**
 * The talking-to-the-API part, shared by the two clients built on it: the
 * public one in `client.ts` and the admin one in `admin.ts`. Both speak the
 * same envelope and raise the same error, so they read the same to whoever
 * catches it - a screen does not care which client the failure came from.
 */

export class ApiClientError extends Error {
  readonly code: DomainErrorCode | BadResponseCode;
  readonly status: number;
  /** Per-field messages from a VALIDATION_FAILED response, when present. */
  readonly fieldErrors: Readonly<Record<string, string[]>>;

  constructor(
    code: DomainErrorCode | BadResponseCode,
    message: string,
    status: number,
    fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string;
  /** Forwarded to the API so a session can be named after the device it runs on. */
  userAgent?: string;
}

export interface Http {
  request(path: string, options?: RequestOptions): Promise<{ payload: unknown; status: number }>;
  requestParsed<T>(schema: ZodType<T>, path: string, options?: RequestOptions): Promise<T>;
}

export function createHttp({ baseUrl, fetch: fetchImpl = globalThis.fetch }: ApiClientOptions): Http {
  const root = baseUrl.replace(/\/+$/, '');

  async function request(
    path: string,
    { method = 'GET', body, accessToken, userAgent }: RequestOptions = {},
  ): Promise<{ payload: unknown; status: number }> {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (accessToken) {
      headers['authorization'] = `Bearer ${accessToken}`;
    }
    if (userAgent) {
      headers['user-agent'] = userAgent;
    }

    const response = await fetchImpl(`${root}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const payload: unknown =
      response.status === 204 ? null : await response.json().catch(() => null);

    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(payload);
      throw new ApiClientError(
        parsed.success ? parsed.data.code : BAD_RESPONSE_CODE,
        parsed.success ? parsed.data.message : `Request to ${path} failed`,
        response.status,
        parsed.success ? toFieldErrors(parsed.data.details) : {},
      );
    }

    return { payload, status: response.status };
  }

  return {
    request,

    async requestParsed<T>(
      schema: ZodType<T>,
      path: string,
      options?: RequestOptions,
    ): Promise<T> {
      const { payload, status } = await request(path, options);
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        throw new ApiClientError(BAD_RESPONSE_CODE, `Unexpected ${path} payload shape`, status);
      }
      return parsed.data;
    },
  };
}

/**
 * `details` is typed `unknown` in the shared envelope because different codes
 * carry different shapes; only the validation one is a field map, and anything
 * else is dropped rather than shown to a visitor as-is.
 */
function toFieldErrors(details: unknown): Record<string, string[]> {
  if (typeof details !== 'object' || details === null) {
    return {};
  }

  const result: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(details)) {
    if (Array.isArray(messages) && messages.every((m) => typeof m === 'string')) {
      result[field] = messages;
    }
  }
  return result;
}

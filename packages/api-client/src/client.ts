import {
  apiErrorSchema,
  authResponseSchema,
  healthResponseSchema,
  publicUserSchema,
  BAD_RESPONSE_CODE,
  type AuthResponse,
  type BadResponseCode,
  type DomainErrorCode,
  type HealthResponse,
  type LoginRequest,
  type PublicUser,
  type RegisterRequest,
} from '@palitra/shared';
import type { ZodType } from 'zod';

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

export interface ApiClient {
  getHealth(): Promise<HealthResponse>;
  register(input: RegisterRequest): Promise<AuthResponse>;
  login(input: LoginRequest): Promise<AuthResponse>;
  refresh(refreshToken: string): Promise<AuthResponse>;
  logout(refreshToken: string): Promise<void>;
  verifyEmail(token: string): Promise<PublicUser>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, password: string): Promise<void>;
  getMe(accessToken: string): Promise<PublicUser>;
}

export interface ApiClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  accessToken?: string;
  /** Forwarded to the API so a session can be named after the device it runs on. */
  userAgent?: string;
}

export function createApiClient({
  baseUrl,
  fetch: fetchImpl = globalThis.fetch,
}: ApiClientOptions): ApiClient {
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

  async function requestParsed<T>(
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
  }

  return {
    getHealth: () => requestParsed(healthResponseSchema, '/health'),

    register: (input) =>
      requestParsed(authResponseSchema, '/auth/register', { method: 'POST', body: input }),

    login: (input) =>
      requestParsed(authResponseSchema, '/auth/login', { method: 'POST', body: input }),

    refresh: (refreshToken) =>
      requestParsed(authResponseSchema, '/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      }),

    async logout(refreshToken) {
      await request('/auth/logout', { method: 'POST', body: { refreshToken } });
    },

    verifyEmail: (token) =>
      requestParsed(publicUserSchema, '/auth/verify-email', { method: 'POST', body: { token } }),

    async requestPasswordReset(email) {
      await request('/auth/password-reset/request', { method: 'POST', body: { email } });
    },

    async resetPassword(token, password) {
      await request('/auth/password-reset/confirm', { method: 'POST', body: { token, password } });
    },

    getMe: (accessToken) => requestParsed(publicUserSchema, '/auth/me', { accessToken }),
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

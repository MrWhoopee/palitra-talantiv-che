import {
  apiErrorSchema,
  healthResponseSchema,
  type DomainErrorCode,
  type HealthResponse,
} from '@palitra/shared';

export class ApiClientError extends Error {
  readonly code: DomainErrorCode | 'BAD_RESPONSE';
  readonly status: number;

  constructor(code: DomainErrorCode | 'BAD_RESPONSE', message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}

export interface ApiClient {
  getHealth(): Promise<HealthResponse>;
}

export interface ApiClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

export function createApiClient({
  baseUrl,
  fetch: fetchImpl = globalThis.fetch,
}: ApiClientOptions): ApiClient {
  const root = baseUrl.replace(/\/+$/, '');

  async function requestJson(path: string): Promise<unknown> {
    const response = await fetchImpl(`${root}${path}`);
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(payload);
      throw new ApiClientError(
        parsed.success ? parsed.data.code : 'BAD_RESPONSE',
        parsed.success ? parsed.data.message : `Request to ${path} failed`,
        response.status,
      );
    }

    return payload;
  }

  return {
    async getHealth(): Promise<HealthResponse> {
      const payload = await requestJson('/health');
      const parsed = healthResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ApiClientError('BAD_RESPONSE', 'Unexpected /health payload shape', 200);
      }
      return parsed.data;
    },
  };
}

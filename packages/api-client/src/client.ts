import {
  apiErrorSchema,
  healthResponseSchema,
  BAD_RESPONSE_CODE,
  type BadResponseCode,
  type DomainErrorCode,
  type HealthResponse,
} from '@palitra/shared';

export class ApiClientError extends Error {
  readonly code: DomainErrorCode | BadResponseCode;
  readonly status: number;

  constructor(code: DomainErrorCode | BadResponseCode, message: string, status: number) {
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

  async function requestJson(path: string): Promise<{ payload: unknown; status: number }> {
    const response = await fetchImpl(`${root}${path}`);
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(payload);
      throw new ApiClientError(
        parsed.success ? parsed.data.code : BAD_RESPONSE_CODE,
        parsed.success ? parsed.data.message : `Request to ${path} failed`,
        response.status,
      );
    }

    return { payload, status: response.status };
  }

  return {
    async getHealth(): Promise<HealthResponse> {
      const { payload, status } = await requestJson('/health');
      const parsed = healthResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ApiClientError(BAD_RESPONSE_CODE, 'Unexpected /health payload shape', status);
      }
      return parsed.data;
    },
  };
}

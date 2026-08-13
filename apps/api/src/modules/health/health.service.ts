import type { HealthResponse } from '@palitra/shared';

export async function buildHealthReport(
  checkDatabase: () => Promise<boolean>,
  uptimeSeconds: number,
): Promise<HealthResponse> {
  let database: HealthResponse['database'];
  try {
    database = (await checkDatabase()) ? 'up' : 'down';
  } catch {
    database = 'down';
  }

  return {
    status: database === 'up' ? 'ok' : 'degraded',
    uptimeSeconds: Math.max(0, Math.round(uptimeSeconds * 1000) / 1000),
    database,
  };
}

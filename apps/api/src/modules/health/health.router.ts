import { Router } from 'express';
import { buildHealthReport } from './health.service';

export function createHealthRouter(checkDatabase: () => Promise<boolean>): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const report = await buildHealthReport(checkDatabase, process.uptime());
    res.status(report.status === 'ok' ? 200 : 503).json(report);
  });

  return router;
}

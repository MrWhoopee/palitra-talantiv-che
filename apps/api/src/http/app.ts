import type { ApiError } from '@palitra/shared';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { createHealthRouter } from '../modules/health/health.router';
import { errorHandler } from './error-handler';

export interface AppDeps {
  checkDatabase: () => Promise<boolean>;
  webOrigin?: string;
}

export function createApp({ checkDatabase, webOrigin }: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: webOrigin ?? 'http://localhost:3000', credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use(createHealthRouter(checkDatabase));

  app.use((_req, res) => {
    const body: ApiError = { code: 'NOT_FOUND', message: 'Route not found' };
    res.status(404).json(body);
  });

  app.use(errorHandler);

  return app;
}

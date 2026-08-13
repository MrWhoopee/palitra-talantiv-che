import type { ApiError } from '@palitra/shared';
import cors from 'cors';
import express, { type Express, type Router } from 'express';
import helmet from 'helmet';
import { createHealthRouter } from '../modules/health/health.router';
import { errorHandler } from './error-handler';

export interface AppDeps {
  checkDatabase: () => Promise<boolean>;
  webOrigin?: string;
  /**
   * Feature routers, mounted between health and the 404. Passing them in keeps
   * this file from importing every module in the app - and lets a test build
   * an app with only the router it is about to exercise.
   */
  routers?: readonly Router[];
}

export function createApp({ checkDatabase, webOrigin, routers = [] }: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: webOrigin ?? 'http://localhost:3000', credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use(createHealthRouter(checkDatabase));

  for (const router of routers) {
    app.use(router);
  }

  app.use((_req, res) => {
    const body: ApiError = { code: 'NOT_FOUND', message: 'Route not found' };
    res.status(404).json(body);
  });

  app.use(errorHandler);

  return app;
}

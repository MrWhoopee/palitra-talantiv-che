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
  /**
   * Where the local storage adapter writes. Given, the same directory is
   * served at `/uploads`; omitted, nothing is served - which is what the tests
   * want, and what a deployment on object storage will want too.
   */
  uploadsDir?: string | undefined;
}

export function createApp({
  checkDatabase,
  webOrigin,
  routers = [],
  uploadsDir,
}: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: webOrigin ?? 'http://localhost:3000', credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  if (uploadsDir) {
    app.use(
      '/uploads',
      // `helmet()` labels every response same-origin, and the site runs on a
      // different origin than the API - without this the pictures would be
      // fetched successfully and then refused by the browser.
      helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }),
      // Names are random and content-addressed by nothing, so a stored file
      // never changes: a year of caching is safe and the pictures are the
      // heaviest thing the site serves.
      express.static(uploadsDir, { maxAge: '365d', immutable: true, index: false }),
    );
  }

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

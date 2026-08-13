import 'dotenv/config';
import { createApp } from './http/app.js';
import { createDatabaseCheck } from './lib/database-check.js';
import { loadEnv } from './lib/env.js';
import { prisma } from './lib/prisma.js';

const env = loadEnv();

const app = createApp({
  checkDatabase: createDatabaseCheck(prisma),
  webOrigin: env.WEB_ORIGIN,
});

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

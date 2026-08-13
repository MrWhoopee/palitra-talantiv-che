import 'dotenv/config';
import { createApp } from './http/app';
import { createAccessTokenService } from './lib/access-token';
import { createDatabaseCheck } from './lib/database-check';
import { loadEnv } from './lib/env';
import { createSmtpMailer } from './lib/mailer';
import { prisma } from './lib/prisma';
import { AUTH_TTL } from './modules/auth/auth.config';
import { createAuthRouter } from './modules/auth/auth.router';
import { createAuthService } from './modules/auth/auth.service';
import { createAvailabilityRouter } from './modules/availability/availability.router';
import { createAvailabilityService } from './modules/availability/availability.service';
import { createTeachersRouter } from './modules/teachers/teachers.router';
import { createTeachersService } from './modules/teachers/teachers.service';

const env = loadEnv();

const accessTokens = createAccessTokenService({
  secret: env.JWT_SECRET,
  ttlSeconds: AUTH_TTL.accessTokenSeconds,
});

const auth = createAuthService({
  prisma,
  accessTokens,
  mailer: createSmtpMailer({ host: env.SMTP_HOST, port: env.SMTP_PORT, from: env.MAIL_FROM }),
  // Links in outgoing mail point at the web app, which is what people can
  // actually open - the API has no pages.
  webOrigin: env.WEB_ORIGIN,
});

const app = createApp({
  checkDatabase: createDatabaseCheck(prisma),
  webOrigin: env.WEB_ORIGIN,
  routers: [
    createAuthRouter({ auth, accessTokens }),
    createTeachersRouter({ teachers: createTeachersService({ prisma }) }),
    createAvailabilityRouter({
      availability: createAvailabilityService({ prisma }),
      accessTokens,
    }),
  ],
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

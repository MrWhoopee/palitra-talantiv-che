import 'dotenv/config';
import { createApp } from './http/app';
import { createAccessTokenService } from './lib/access-token';
import { createDatabaseCheck } from './lib/database-check';
import { loadEnv } from './lib/env';
import { createSmtpMailer } from './lib/mailer';
import { prisma } from './lib/prisma';
import { createLocalDiskStorage } from './lib/storage';
import { createAdminRouter } from './modules/admin/admin.router';
import { createUploadsAdminRouter } from './modules/uploads/uploads.admin.router';
import { AUTH_TTL } from './modules/auth/auth.config';
import { createAuthRouter } from './modules/auth/auth.router';
import { createAuthService } from './modules/auth/auth.service';
import { createAvailabilityRouter } from './modules/availability/availability.router';
import { createAvailabilityService } from './modules/availability/availability.service';
import { createBookingRouter } from './modules/booking/booking.router';
import { createBookingService } from './modules/booking/booking.service';
import { createContentAdminRouter } from './modules/content/content.admin.router';
import { createContentRouter } from './modules/content/content.router';
import { createContentService } from './modules/content/content.service';
import { createGroupsRouter } from './modules/groups/groups.router';
import { createGroupsService } from './modules/groups/groups.service';
import { createSubscriptionsRouter } from './modules/subscriptions/subscriptions.router';
import { createSubscriptionService } from './modules/subscriptions/subscriptions.service';
import { createTeachersRouter } from './modules/teachers/teachers.router';
import { createTeachersService } from './modules/teachers/teachers.service';

const env = loadEnv();

const accessTokens = createAccessTokenService({
  secret: env.JWT_SECRET,
  ttlSeconds: AUTH_TTL.accessTokenSeconds,
});

const mailer = createSmtpMailer({ host: env.SMTP_HOST, port: env.SMTP_PORT, from: env.MAIL_FROM });

const availability = createAvailabilityService({ prisma });
const subscriptions = createSubscriptionService({ prisma });
const content = createContentService({ prisma });

const auth = createAuthService({
  prisma,
  accessTokens,
  mailer,
  // Links in outgoing mail point at the web app, which is what people can
  // actually open - the API has no pages.
  webOrigin: env.WEB_ORIGIN,
});

const storage = createLocalDiskStorage({
  dir: env.STORAGE_DIR,
  publicBaseUrl: `${env.PUBLIC_API_URL}/uploads`,
});

const app = createApp({
  checkDatabase: createDatabaseCheck(prisma),
  webOrigin: env.WEB_ORIGIN,
  uploadsDir: env.STORAGE_DIR,
  routers: [
    createAuthRouter({ auth, accessTokens }),
    createTeachersRouter({ teachers: createTeachersService({ prisma }) }),
    createAvailabilityRouter({ availability, accessTokens }),
    createBookingRouter({
      booking: createBookingService({
        prisma,
        availability,
        subscriptions,
        mailer,
        webOrigin: env.WEB_ORIGIN,
      }),
      accessTokens,
    }),
    createSubscriptionsRouter({ subscriptions, accessTokens }),
    createGroupsRouter({ groups: createGroupsService({ prisma }), accessTokens }),
    createContentRouter({ content }),
    createAdminRouter({
      accessTokens,
      routers: [
        createUploadsAdminRouter({ storage }),
        createContentAdminRouter({ content, storage }),
      ],
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

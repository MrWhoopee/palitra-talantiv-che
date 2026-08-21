import 'dotenv/config';
import { createApp } from './http/app';
import { createAccessTokenService } from './lib/access-token';
import { createDatabaseCheck } from './lib/database-check';
import { loadEnv } from './lib/env';
import { createSmtpMailer } from './lib/mailer';
import { prisma } from './lib/prisma';
import { createLocalDiskStorage } from './lib/storage';
import { createAdminRouter } from './modules/admin/admin.router';
import { createOperationsAdminRouter } from './modules/admin/operations.admin.router';
import { createStudentsService } from './modules/students/students.service';
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
import { createSiteAdminRouter } from './modules/site/site.admin.router';
import { createSiteRouter } from './modules/site/site.router';
import { createSiteService } from './modules/site/site.service';
import { createGroupsService } from './modules/groups/groups.service';
import { createSubscriptionsRouter } from './modules/subscriptions/subscriptions.router';
import { createSubscriptionService } from './modules/subscriptions/subscriptions.service';
import { createTeachersAdminRouter } from './modules/teachers/teachers.admin.router';
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
const site = createSiteService({ prisma });

const auth = createAuthService({
  prisma,
  accessTokens,
  mailer,
  // Links in outgoing mail point at the web app, which is what people can
  // actually open - the API has no pages.
  webOrigin: env.WEB_ORIGIN,
});

// Built after `auth`, which is what it sends invitations through.
const teachers = createTeachersService({ prisma, invite: auth });

const storage = createLocalDiskStorage({
  dir: env.STORAGE_DIR,
  publicBaseUrl: `${env.PUBLIC_API_URL}/uploads`,
});

// Named rather than built inline, because the cabinet reaches the same two
// services the cabinet-facing routers do. Two instances would be two of every
// decision they hold - the clock they read, the config they were given.
const booking = createBookingService({
  prisma,
  availability,
  subscriptions,
  mailer,
  webOrigin: env.WEB_ORIGIN,
});
const groups = createGroupsService({ prisma });
const students = createStudentsService({ prisma });

const app = createApp({
  checkDatabase: createDatabaseCheck(prisma),
  webOrigin: env.WEB_ORIGIN,
  uploadsDir: env.STORAGE_DIR,
  routers: [
    createAuthRouter({ auth, accessTokens }),
    createTeachersRouter({ teachers }),
    createAvailabilityRouter({ availability, accessTokens }),
    createBookingRouter({ booking, accessTokens }),
    createSubscriptionsRouter({ subscriptions, accessTokens }),
    createGroupsRouter({ groups, accessTokens }),
    createContentRouter({ content }),
    createSiteRouter({ site }),
    createAdminRouter({
      accessTokens,
      routers: [
        createUploadsAdminRouter({ storage }),
        createTeachersAdminRouter({ teachers }),
        createContentAdminRouter({ content, storage }),
        createSiteAdminRouter({ site }),
        createOperationsAdminRouter({ booking, groups, students, subscriptions }),
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

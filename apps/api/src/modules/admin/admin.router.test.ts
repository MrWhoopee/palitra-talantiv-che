import type { Express, Router } from 'express';
import request from 'supertest';
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../http/app';
import { createAccessTokenService } from '../../lib/access-token';
import type { StorageAdapter } from '../../lib/storage';
import type { BookingService } from '../booking/booking.service';
import type { GroupsService } from '../groups/groups.service';
import type { StudentsService } from '../students/students.service';
import type { SubscriptionService } from '../subscriptions/subscriptions.service';
import { createUploadsAdminRouter } from '../uploads/uploads.admin.router';
import { createAdminRouter } from './admin.router';
import { createOperationsAdminRouter } from './operations.admin.router';

const accessTokens = createAccessTokenService({ secret: 'test-secret'.repeat(4), ttlSeconds: 900 });

const ADMIN_ID = '0195c8a0-0000-7000-8000-000000000001';
const TEACHER_ID = '0195c8a0-0000-7000-8000-000000000002';

function tokenFor(role: 'ADMIN' | 'TEACHER'): Promise<string> {
  return accessTokens.sign({ userId: role === 'ADMIN' ? ADMIN_ID : TEACHER_ID, role });
}

/** Files written into memory instead of onto a disk the tests would have to clean. */
function createMemoryStorage(): StorageAdapter & { saved: Buffer[] } {
  const saved: Buffer[] = [];
  return {
    saved,
    async save({ data }) {
      saved.push(data);
      return { url: `http://localhost:4000/uploads/${saved.length}.webp` };
    },
    async remove() {},
  };
}

/**
 * The operational routes are mounted here so the table below covers them too.
 * Nothing behind them is called: every request in these tests is refused at
 * the prefix, which is exactly the property being tested, so a service that
 * would throw if reached is the honest stub.
 */
const unreachable = new Proxy(
  {},
  {
    get() {
      return () => {
        throw new Error('A guarded route reached its service');
      };
    },
  },
);

let storage: ReturnType<typeof createMemoryStorage>;
let adminRouter: Router;
let app: Express;

beforeEach(() => {
  storage = createMemoryStorage();
  adminRouter = createAdminRouter({
    accessTokens,
    routers: [
      createUploadsAdminRouter({ storage }),
      createOperationsAdminRouter({
        booking: unreachable as BookingService,
        groups: unreachable as GroupsService,
        students: unreachable as StudentsService,
        subscriptions: unreachable as SubscriptionService,
      }),
    ],
  });
  app = createApp({ checkDatabase: async () => true, routers: [adminRouter] });
});

/**
 * Every route reachable through the admin router, discovered from the router
 * itself rather than from a list kept by hand. A list would be one more thing
 * to remember, and the whole point of mounting the guard on the prefix is that
 * nothing has to be remembered per route.
 */
function routesOf(router: Router): { method: string; path: string }[] {
  const found: { method: string; path: string }[] = [];

  function walk(layer: { route?: unknown; handle?: unknown }): void {
    const route = layer.route as { path: string; methods: Record<string, boolean> } | undefined;
    if (route) {
      for (const method of Object.keys(route.methods)) {
        found.push({ method, path: route.path });
      }
      return;
    }

    const nested = (layer.handle as { stack?: unknown[] } | undefined)?.stack;
    if (Array.isArray(nested)) {
      for (const inner of nested) {
        walk(inner as { route?: unknown; handle?: unknown });
      }
    }
  }

  for (const layer of (router as unknown as { stack: unknown[] }).stack) {
    walk(layer as { route?: unknown; handle?: unknown });
  }
  return found;
}

const SOME_ID = '0195c8a0-0000-7000-8000-0000000000ff';

/** `request(app).post('/admin/uploads')`, with the verb chosen at runtime. */
function call(method: string, path: string): request.Test {
  const agent = request(app) as unknown as Record<string, (p: string) => request.Test>;
  return agent[method]!(path.replace(/:[A-Za-z]+/g, SOME_ID));
}

describe('the admin prefix', () => {
  it('has routes to guard', () => {
    // Guards against the table tests below silently passing on an empty set.
    expect(routesOf(adminRouter).length).toBeGreaterThan(0);
  });

  it('every route under it refuses an anonymous caller', async () => {
    for (const { method, path } of routesOf(adminRouter)) {
      const { status } = await call(method, path);

      // Reported with the route in the object so a failure names the offender
      // instead of only saying that some status was 200.
      expect({ method, path, status }).toEqual({ method, path, status: 401 });
    }
  });

  it('every route under it refuses a teacher', async () => {
    const token = await tokenFor('TEACHER');

    for (const { method, path } of routesOf(adminRouter)) {
      const { status } = await call(method, path).set('Authorization', `Bearer ${token}`);

      expect({ method, path, status }).toEqual({ method, path, status: 403 });
    }
  });

  it('lets a request that is not addressed to it through untouched', async () => {
    // The admin router is one of several mounted side by side. If its guard
    // ran for everything passing through, the public site would need a login.
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
  });
});

describe('POST /admin/uploads', () => {
  async function photo(): Promise<Buffer> {
    return sharp({ create: { width: 40, height: 30, channels: 3, background: '#c86' } })
      .jpeg()
      .toBuffer();
  }

  it('stores an uploaded photo and answers with its address', async () => {
    const response = await request(app)
      .post('/admin/uploads')
      .set('Authorization', `Bearer ${await tokenFor('ADMIN')}`)
      .attach('file', await photo(), 'concert.jpg');

    expect(response.status).toBe(201);
    expect(response.body.url).toMatch(/^http:\/\/localhost:4000\/uploads\//);
    expect(storage.saved).toHaveLength(1);
  });

  it('refuses a file that is not an image', async () => {
    const response = await request(app)
      .post('/admin/uploads')
      .set('Authorization', `Bearer ${await tokenFor('ADMIN')}`)
      .attach('file', Buffer.from('%PDF-1.7'), 'prices.pdf');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(storage.saved).toHaveLength(0);
  });

  it('refuses a request with no file at all', async () => {
    const response = await request(app)
      .post('/admin/uploads')
      .set('Authorization', `Bearer ${await tokenFor('ADMIN')}`);

    expect(response.status).toBe(400);
  });
});

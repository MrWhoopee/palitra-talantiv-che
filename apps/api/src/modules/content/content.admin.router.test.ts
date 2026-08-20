import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../http/app';
import { createAccessTokenService } from '../../lib/access-token';
import type { StorageAdapter } from '../../lib/storage';
import { createTestPrisma, resetDatabase } from '../../test/database';
import { createAdminRouter } from '../admin/admin.router';
import { createContentAdminRouter } from './content.admin.router';
import { createContentRouter } from './content.router';
import { createContentService } from './content.service';

const prisma = createTestPrisma();
const accessTokens = createAccessTokenService({ secret: 'test-secret'.repeat(4), ttlSeconds: 900 });
const content = createContentService({ prisma });

const removed: string[] = [];
const storage: StorageAdapter = {
  async save() {
    return { url: 'http://localhost:4000/uploads/unused.webp' };
  },
  async remove(url) {
    removed.push(url);
  },
};

const app: Express = createApp({
  checkDatabase: async () => true,
  routers: [
    createContentRouter({ content }),
    createAdminRouter({
      accessTokens,
      routers: [createContentAdminRouter({ content, storage })],
    }),
  ],
});

let auth: string;

beforeEach(async () => {
  await resetDatabase(prisma);
  removed.length = 0;
  auth = `Bearer ${await accessTokens.sign({
    userId: '0195c8a0-0000-7000-8000-000000000001',
    role: 'ADMIN',
  })}`;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const concert = {
  slug: 'zvitnyi-kontsert',
  title: 'Звітний концерт',
  description: 'Наші учні на сцені',
  startsAt: '2026-12-20T16:00:00.000Z',
  endsAt: '2026-12-20T18:00:00.000Z',
  kind: 'CONCERT',
};

function createEvent(overrides: Record<string, unknown> = {}) {
  return request(app)
    .post('/admin/events')
    .set('Authorization', auth)
    .send({ ...concert, ...overrides });
}

describe('admin events', () => {
  it('creates an event as a draft', async () => {
    const response = await createEvent();

    expect(response.status).toBe(201);
    // Nothing the studio types goes on the site by accident: publishing is a
    // second, deliberate action.
    expect(response.body.isPublished).toBe(false);
  });

  it('keeps a draft out of the public playbill and shows it to the admin', async () => {
    await createEvent();

    const publicList = await request(app).get('/events?when=all');
    const adminList = await request(app).get('/admin/events').set('Authorization', auth);

    expect(publicList.body).toHaveLength(0);
    expect(adminList.body).toHaveLength(1);
  });

  it('puts the event on the site when it is published', async () => {
    const { body } = await createEvent();

    await request(app)
      .patch(`/admin/events/${body.id}`)
      .set('Authorization', auth)
      .send({ isPublished: true });

    const publicList = await request(app).get('/events?when=all');
    expect(publicList.body).toHaveLength(1);
    expect(publicList.body[0].title).toBe('Звітний концерт');
  });

  it('refuses a slug that is already taken', async () => {
    await createEvent();

    const response = await createEvent({ title: 'Інший концерт' });

    // The slug is the address of the page; two events cannot share one.
    expect(response.status).toBe(409);
  });

  it('refuses an event that ends before it starts', async () => {
    const response = await createEvent({ endsAt: '2026-12-20T15:00:00.000Z' });

    expect(response.status).toBe(400);
  });

  it('deletes an event', async () => {
    const { body } = await createEvent();

    const response = await request(app)
      .delete(`/admin/events/${body.id}`)
      .set('Authorization', auth);

    expect(response.status).toBe(204);
    expect(await prisma.studioEvent.count()).toBe(0);
  });

  it('keeps the photos when the event they belong to is deleted', async () => {
    const { body } = await createEvent();
    await request(app)
      .post('/admin/gallery')
      .set('Authorization', auth)
      .send({ url: 'http://localhost:4000/uploads/a.webp', eventId: body.id });

    await request(app).delete(`/admin/events/${body.id}`).set('Authorization', auth);

    // A concert removed from the playbill does not take the pictures of it
    // with it - they are the studio's, and the gallery outlives the listing.
    const photos = await prisma.galleryItem.findMany();
    expect(photos).toHaveLength(1);
    expect(photos[0]?.eventId).toBeNull();
  });
});

describe('admin gallery', () => {
  function addPhoto(overrides: Record<string, unknown> = {}) {
    return request(app)
      .post('/admin/gallery')
      .set('Authorization', auth)
      .send({ url: 'http://localhost:4000/uploads/photo.webp', caption: 'Концерт', ...overrides });
  }

  it('adds a photo, published, because a photo is not a draft', async () => {
    const response = await addPhoto();

    expect(response.status).toBe(201);
    expect(response.body.isPublished).toBe(true);
  });

  it('deletes the stored file along with the row', async () => {
    const { body } = await addPhoto();

    await request(app).delete(`/admin/gallery/${body.id}`).set('Authorization', auth);

    // Otherwise the disk fills with pictures nothing refers to any more.
    expect(removed).toContain('http://localhost:4000/uploads/photo.webp');
  });

  it('reorders the gallery in one request', async () => {
    const first = (await addPhoto({ url: 'http://localhost:4000/uploads/1.webp' })).body;
    const second = (await addPhoto({ url: 'http://localhost:4000/uploads/2.webp' })).body;

    await request(app)
      .put('/admin/gallery/order')
      .set('Authorization', auth)
      .send({ ids: [second.id, first.id] });

    const gallery = await request(app).get('/gallery');
    expect(gallery.body.map((item: { url: string }) => item.url)).toEqual([
      'http://localhost:4000/uploads/2.webp',
      'http://localhost:4000/uploads/1.webp',
    ]);
  });

  it('refuses a video link that is not a video', async () => {
    const response = await addPhoto({ kind: 'VIDEO', url: 'https://example.com/not-a-video' });

    expect(response.status).toBe(400);
  });
});

describe('admin testimonials', () => {
  it('holds a testimonial back until someone approves it', async () => {
    const response = await request(app)
      .post('/admin/testimonials')
      .set('Authorization', auth)
      .send({ authorName: 'Марія', text: 'Донька біжить на заняття' });

    expect(response.status).toBe(201);
    // Nobody's words go on the site until someone decides they should.
    expect(response.body.isPublished).toBe(false);

    const publicList = await request(app).get('/testimonials');
    expect(publicList.body).toHaveLength(0);
  });
});

describe('admin achievements', () => {
  it('creates and publishes an achievement', async () => {
    const created = await request(app)
      .post('/admin/achievements')
      .set('Authorization', auth)
      .send({ title: 'Перемога на конкурсі', year: 2025 });

    expect(created.status).toBe(201);

    await request(app)
      .patch(`/admin/achievements/${created.body.id}`)
      .set('Authorization', auth)
      .send({ isPublished: true });

    const publicList = await request(app).get('/achievements');
    expect(publicList.body).toHaveLength(1);
  });

  it('refuses a year outside living memory', async () => {
    const response = await request(app)
      .post('/admin/achievements')
      .set('Authorization', auth)
      .send({ title: 'Перемога', year: 1200 });

    // The column is a smallint and the studio opened in 2011; a typo like 205
    // or 20255 should not reach the database.
    expect(response.status).toBe(400);
  });
});

import { playbillDayStart, studioEventListSchema, studioEventSchema } from '@palitra/shared';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../http/app';
import { createTestPrisma, resetDatabase } from '../../test/database';
import { createContentRouter } from './content.router';
import { createContentService } from './content.service';

const prisma = createTestPrisma();

const app: Express = createApp({
  checkDatabase: async () => true,
  routers: [createContentRouter({ content: createContentService({ prisma }) })],
});

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const HOUR = 60 * 60 * 1000;

async function createEvent(overrides: {
  slug: string;
  title?: string;
  startsAt: Date;
  endsAt?: Date | null;
  isPublished?: boolean;
}) {
  return prisma.studioEvent.create({
    data: {
      slug: overrides.slug,
      title: overrides.title ?? 'Концерт',
      startsAt: overrides.startsAt,
      endsAt: overrides.endsAt ?? null,
      isPublished: overrides.isPublished ?? true,
    },
  });
}

describe('GET /events', () => {
  it('leaves a draft out of the playbill', async () => {
    await createEvent({ slug: 'draft', startsAt: new Date(Date.now() + 24 * HOUR) });
    await createEvent({
      slug: 'hidden',
      startsAt: new Date(Date.now() + 24 * HOUR),
      isPublished: false,
    });

    const response = await request(app).get('/events');

    expect(response.status).toBe(200);
    const body = studioEventListSchema.parse(response.body);
    expect(body.map((event) => event.slug)).toStrictEqual(['draft']);
  });

  it('sorts the upcoming ones soonest first and the archive newest first', async () => {
    await createEvent({ slug: 'later', startsAt: new Date(Date.now() + 10 * 24 * HOUR) });
    await createEvent({ slug: 'sooner', startsAt: new Date(Date.now() + 2 * 24 * HOUR) });
    await createEvent({ slug: 'old', startsAt: new Date(Date.now() - 30 * 24 * HOUR) });
    await createEvent({ slug: 'recent', startsAt: new Date(Date.now() - 2 * 24 * HOUR) });

    const upcoming = studioEventListSchema.parse((await request(app).get('/events')).body);
    const past = studioEventListSchema.parse((await request(app).get('/events?when=past')).body);

    expect(upcoming.map((event) => event.slug)).toStrictEqual(['sooner', 'later']);
    expect(past.map((event) => event.slug)).toStrictEqual(['recent', 'old']);
  });

  /**
   * The one case a flag would get wrong: it is 20:00, the concert started at
   * 18:00 and runs until 21:00. Nobody is going to move it into the archive by
   * hand while it is happening.
   */
  it('keeps an event that is happening right now in the playbill', async () => {
    await createEvent({
      slug: 'in-progress',
      startsAt: new Date(Date.now() - 2 * HOUR),
      endsAt: new Date(Date.now() + HOUR),
    });

    const upcoming = studioEventListSchema.parse((await request(app).get('/events')).body);
    const past = studioEventListSchema.parse((await request(app).get('/events?when=past')).body);

    expect(upcoming.map((event) => event.slug)).toStrictEqual(['in-progress']);
    expect(past).toStrictEqual([]);
  });

  /**
   * Most events the studio announces have a start and nothing else. Split on
   * `startsAt > now` such an event would leave the playbill a minute after it
   * began; it belongs there until its day is over in Kyiv, and only then in
   * the archive.
   */
  it('keeps an event with no end time in the playbill until its Kyiv day ends', async () => {
    const dayStart = playbillDayStart();

    await createEvent({ slug: 'this-morning', startsAt: new Date(dayStart.getTime() + 9 * HOUR) });
    await createEvent({ slug: 'yesterday', startsAt: new Date(dayStart.getTime() - 3 * HOUR) });

    const upcoming = studioEventListSchema.parse((await request(app).get('/events')).body);
    const past = studioEventListSchema.parse((await request(app).get('/events?when=past')).body);

    expect(upcoming.map((event) => event.slug)).toContain('this-morning');
    expect(past.map((event) => event.slug)).toStrictEqual(['yesterday']);
  });
});

describe('GET /events/:slug', () => {
  it('returns a published event', async () => {
    await createEvent({ slug: 'kontsert', title: 'Звітний', startsAt: new Date() });

    const response = await request(app).get('/events/kontsert');

    expect(response.status).toBe(200);
    expect(studioEventSchema.parse(response.body).title).toBe('Звітний');
  });

  it('answers 404 for a draft, exactly as for a slug that does not exist', async () => {
    await createEvent({ slug: 'draft', startsAt: new Date(), isPublished: false });

    const hidden = await request(app).get('/events/draft');
    const missing = await request(app).get('/events/never-existed');

    expect(hidden.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(hidden.body).toStrictEqual(missing.body);
  });
});

describe('GET /testimonials and /achievements', () => {
  it('returns only what has been published', async () => {
    await prisma.testimonial.createMany({
      data: [
        { authorName: 'Тестова родина', text: 'Опубліковано', isPublished: true },
        { authorName: 'Чернетка', text: 'Ще ні', isPublished: false },
      ],
    });
    await prisma.achievement.createMany({
      data: [
        { title: 'Перемога', year: 2024, isPublished: true },
        { title: 'Чернетка', year: 2025, isPublished: false },
      ],
    });

    const testimonials = await request(app).get('/testimonials');
    const achievements = await request(app).get('/achievements');

    expect(testimonials.body).toHaveLength(1);
    expect(testimonials.body[0].authorName).toBe('Тестова родина');
    expect(achievements.body).toHaveLength(1);
    expect(achievements.body[0].title).toBe('Перемога');
  });
});

describe('GET /gallery', () => {
  it('returns published items in the studio order and names the event they came from', async () => {
    const event = await createEvent({ slug: 'zvitnyi', startsAt: new Date() });

    await prisma.galleryItem.createMany({
      data: [
        { url: '/demo/2.svg', sortOrder: 2, isPublished: true },
        { url: '/demo/1.svg', sortOrder: 1, isPublished: true, eventId: event.id },
        { url: '/demo/hidden.svg', sortOrder: 0, isPublished: false },
      ],
    });

    const response = await request(app).get('/gallery');

    expect(response.status).toBe(200);
    expect(response.body.map((item: { url: string }) => item.url)).toStrictEqual([
      '/demo/1.svg',
      '/demo/2.svg',
    ]);
    expect(response.body[0].eventSlug).toBe('zvitnyi');
    expect(response.body[1].eventSlug).toBeNull();
  });
});

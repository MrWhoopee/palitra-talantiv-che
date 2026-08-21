import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../http/app';
import { createAccessTokenService } from '../../lib/access-token';
import { createTestPrisma, resetDatabase } from '../../test/database';
import { createAdminRouter } from '../admin/admin.router';
import { createSiteAdminRouter } from './site.admin.router';
import { createSiteRouter } from './site.router';
import { createSiteService } from './site.service';

const prisma = createTestPrisma();
const accessTokens = createAccessTokenService({ secret: 'test-secret'.repeat(4), ttlSeconds: 900 });
const site = createSiteService({ prisma });

const app: Express = createApp({
  checkDatabase: async () => true,
  routers: [
    createSiteRouter({ site }),
    createAdminRouter({ accessTokens, routers: [createSiteAdminRouter({ site })] }),
  ],
});

let admin: string;

beforeEach(async () => {
  await resetDatabase(prisma);
  admin = `Bearer ${await accessTokens.sign({
    userId: '0195c8a0-0000-7000-8000-000000000001',
    role: 'ADMIN',
  })}`;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const about = {
  title: 'Про студію',
  body: 'Ми вчимо співати з 2011 року.\n\nУ нас дві локації.',
};

function saveText(key: string, body: Record<string, unknown> = about) {
  return request(app).put(`/admin/site-texts/${key}`).set('Authorization', admin).send(body);
}

function saveSettings(body: Record<string, unknown>) {
  return request(app).put('/admin/site-settings').set('Authorization', admin).send(body);
}

describe('site texts', () => {
  it('starts empty, so a studio that never opened the screen still has a site', async () => {
    const response = await request(app).get('/site-texts');

    // Every page carries the wording it was built with. A missing row is not
    // an error here - it is the ordinary state of a page nobody has edited.
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('publishes what the studio wrote', async () => {
    const saved = await saveText('about');

    expect(saved.status).toBe(200);

    const { body } = await request(app).get('/site-texts');
    expect(body).toHaveLength(1);
    expect(body[0].key).toBe('about');
    expect(body[0].title).toBe('Про студію');
  });

  it('replaces the text rather than adding a second one', async () => {
    await saveText('about');
    await saveText('about', { title: 'Про нас', body: 'Новий текст про студію.' });

    const { body } = await request(app).get('/site-texts');
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe('Про нас');
  });

  it('refuses a page the site does not have', async () => {
    const response = await saveText('secret-page');

    // Which pages exist is decided by the app's routes. Text filed under a
    // name nothing renders would be work the studio never sees on the site.
    expect(response.status).toBe(404);
    expect(await prisma.siteText.count()).toBe(0);
  });

  it('refuses an empty page body', async () => {
    const response = await saveText('about', { title: 'Про студію', body: '   ' });

    expect(response.status).toBe(400);
  });

  it('is not something a visitor can write', async () => {
    const response = await request(app).put('/admin/site-texts/about').send(about);

    expect(response.status).toBe(401);
    expect(await prisma.siteText.count()).toBe(0);
  });
});

describe('site settings', () => {
  it('stores the contacts the footer shows', async () => {
    const response = await saveSettings({
      phone: '+380671234567',
      instagram: 'https://instagram.com/palitra',
    });

    expect(response.status).toBe(200);

    const { body } = await request(app).get('/site-settings');
    expect(body).toEqual({ phone: '+380671234567', instagram: 'https://instagram.com/palitra' });
  });

  it('leaves alone the keys it was not sent', async () => {
    await saveSettings({ phone: '+380671234567' });

    await saveSettings({ instagram: 'https://instagram.com/palitra' });

    const { body } = await request(app).get('/site-settings');
    expect(body.phone).toBe('+380671234567');
  });

  it('takes an emptied field back to the default in the code', async () => {
    await saveSettings({ phone: '+380671234567' });

    await saveSettings({ phone: '' });

    // Not stored as an empty string: the web app has a default for every one
    // of these, and clearing a field is how the studio gets it back.
    const { body } = await request(app).get('/site-settings');
    expect(body).not.toHaveProperty('phone');
    expect(await prisma.siteSetting.count()).toBe(0);
  });

  it('refuses a link that is not an https address', async () => {
    const response = await saveSettings({ instagram: 'javascript:alert(1)' });

    // Whatever is stored here ends up in an `href` in the footer of every
    // page, and `javascript:` is a valid url as far as a browser is concerned.
    expect(response.status).toBe(400);
    expect(await prisma.siteSetting.count()).toBe(0);
  });

  it('refuses a phone number that is not one', async () => {
    const response = await saveSettings({ phone: 'подзвоніть нам' });

    expect(response.status).toBe(400);
  });
});

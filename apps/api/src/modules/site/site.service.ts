import {
  SITE_SETTING_KEYS,
  type SiteSettings,
  type SiteText,
  type SiteTextInput,
  type SiteTextKey,
} from '@palitra/shared';
import type { PrismaClient } from '../../generated/prisma/client.js';

export interface SiteServiceDeps {
  prisma: PrismaClient;
}

export interface SiteService {
  listTexts(): Promise<SiteText[]>;
  saveText(key: SiteTextKey, input: SiteTextInput): Promise<SiteText>;
  getSettings(): Promise<SiteSettings>;
  saveSettings(input: SiteSettings): Promise<SiteSettings>;
}

/**
 * The studio's own words about itself.
 *
 * Two tables of the same shape - a key the code knows and a value the studio
 * types - and one rule across both: a key with no row is not an error. The web
 * app carries the wording it was built with, the stored rows are laid over it,
 * and a studio that has never opened these screens has a site that reads
 * exactly as it did before they existed.
 */
export function createSiteService({ prisma }: SiteServiceDeps): SiteService {
  async function readSettings(): Promise<SiteSettings> {
    const rows = await prisma.siteSetting.findMany({ where: { key: { in: SITE_SETTING_KEYS } } });

    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  return {
    async listTexts(): Promise<SiteText[]> {
      const rows = await prisma.siteText.findMany({ orderBy: { key: 'asc' } });

      return rows.map(toSiteText);
    },

    /**
     * Written by key rather than created with one: which pages exist is
     * decided by the web app's routes, so `key` arrives already checked
     * against the fixed list and there is no way to file text under a name
     * nothing renders.
     */
    async saveText(key, input): Promise<SiteText> {
      return toSiteText(
        await prisma.siteText.upsert({
          where: { key },
          create: { key, ...input },
          update: input,
        }),
      );
    },

    getSettings: readSettings,

    /**
     * A partial write: the screen sends the fields it was showing, and a key
     * it did not send keeps whatever it had. An empty value is not stored as
     * an empty string - the row is removed, which is what puts the web app's
     * own default back in the footer.
     */
    async saveSettings(input): Promise<SiteSettings> {
      const entries = Object.entries(input).filter(([, value]) => value !== undefined) as [
        string,
        string,
      ][];

      await prisma.$transaction(
        entries.map(([key, value]) =>
          value === ''
            ? prisma.siteSetting.deleteMany({ where: { key } })
            : prisma.siteSetting.upsert({
                where: { key },
                create: { key, value },
                update: { value },
              }),
        ),
      );

      return readSettings();
    },
  };
}

interface SiteTextRow {
  key: string;
  title: string;
  body: string;
  updatedAt: Date;
}

function toSiteText(row: SiteTextRow): SiteText {
  return {
    // Narrowed rather than parsed: the only writer is `saveText`, which takes
    // a key already checked against the fixed list.
    key: row.key as SiteTextKey,
    title: row.title,
    body: row.body,
    updatedAt: row.updatedAt.toISOString(),
  };
}

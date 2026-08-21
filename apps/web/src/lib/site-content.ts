import { parseMarkdown, type MarkdownBlock, type SiteSettings, type SiteTextKey } from '@palitra/shared';
import { api } from '@/lib/api';

/**
 * The studio's own copy, laid over what the site was built with.
 *
 * Neither reader throws. A page whose text the studio has never written shows
 * the words in the code, and so does a page rendered while the API is down -
 * the site reads as it always did rather than losing its heading because a
 * request failed. That is the same rule the empty table follows, applied to
 * one more way of having nothing to show.
 */

export interface SiteCopy {
  title: string;
  blocks: MarkdownBlock[];
}

export async function readSiteCopy(key: SiteTextKey): Promise<SiteCopy | null> {
  const texts = await api.getSiteTexts().catch(() => []);
  const stored = texts.find((text) => text.key === key);

  if (!stored) {
    return null;
  }

  const blocks = parseMarkdown(stored.body);

  // A row whose body parsed to nothing is a row of whitespace. Treating it as
  // "not written" puts the built-in wording back, rather than leaving a
  // heading with silence under it.
  return blocks.length === 0 ? null : { title: stored.title, blocks };
}

export async function readSiteSettings(): Promise<SiteSettings> {
  return api.getSiteSettings().catch(() => ({}));
}

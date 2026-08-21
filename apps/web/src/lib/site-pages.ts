import { SITE_TEXT_KEYS, type SiteTextKey } from '@palitra/shared';

/**
 * The pages whose wording the studio owns, each next to the address it is read
 * at.
 *
 * The set of keys is fixed in `@palitra/shared` and the routes are fixed in
 * this app; this map is where the two meet, so the cabinet can say "this text
 * is what visitors read at /about" rather than listing four bare keys. A key
 * that gained no route here would be text with nowhere to appear, which is why
 * `SITE_PAGES` is built from `SITE_TEXT_KEYS` and not written out by hand.
 */
interface SitePage {
  key: SiteTextKey;
  label: string;
  href: string;
  /** What this page is for, in the voice of the person about to rewrite it. */
  purpose: string;
}

const PAGES: Record<SiteTextKey, Omit<SitePage, 'key'>> = {
  home: {
    label: 'Головна',
    href: '/',
    purpose: 'Перше, що читають про студію: хто ви й чим займаєтесь.',
  },
  about: {
    label: 'Про нас',
    href: '/about',
    purpose: 'Довша розповідь — історія, підхід, чого чекати батькам.',
  },
  rules: {
    label: 'Правила студії',
    href: '/rules',
    purpose: 'Домовленості про запізнення, скасування й оплату.',
  },
  contacts: {
    label: 'Контакти',
    href: '/contacts',
    purpose: 'Слова навколо адрес і телефонів. Самі телефони — на сусідньому екрані.',
  },
};

export const SITE_PAGES: SitePage[] = SITE_TEXT_KEYS.map((key) => ({ key, ...PAGES[key] }));

/** Every page the copy appears on, for the cache to be told after a save. */
export const SITE_PAGE_PATHS: string[] = SITE_PAGES.map((page) => page.href);

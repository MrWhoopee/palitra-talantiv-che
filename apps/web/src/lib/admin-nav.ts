/**
 * Everything the admin cabinet can do, grouped by what it is about.
 *
 * Three groups because the studio's work falls into three: what visitors read,
 * who teaches and for how much, and what happens on a given Tuesday. The
 * grouping is the navigation - a flat list of fifteen links would be a list to
 * read through every time rather than a place to reach for.
 */

export type AdminGroupTone = 'site' | 'studio' | 'work';

export interface AdminScreen {
  href: string;
  label: string;
  /**
   * Temporary. Stage 6 builds these screens one at a time, and a link to a
   * screen that is not there yet is a 404 with the studio's name on it. Every
   * entry here is `true` by the end of the stage, and this field goes with the
   * last one.
   */
  ready: boolean;
}

export interface AdminGroup {
  title: string;
  tone: AdminGroupTone;
  screens: AdminScreen[];
}

export const ADMIN_NAV: AdminGroup[] = [
  {
    title: 'Сайт',
    tone: 'site',
    screens: [
      { href: '/admin/pages', label: 'Сторінки', ready: false },
      { href: '/admin/contacts', label: 'Контакти', ready: false },
      { href: '/admin/events', label: 'Події', ready: false },
      { href: '/admin/gallery', label: 'Галерея', ready: false },
      { href: '/admin/testimonials', label: 'Відгуки', ready: false },
      { href: '/admin/achievements', label: 'Досягнення', ready: false },
    ],
  },
  {
    title: 'Студія',
    tone: 'studio',
    screens: [
      { href: '/admin/teachers', label: 'Викладачі', ready: false },
      { href: '/admin/directions', label: 'Напрями', ready: false },
      { href: '/admin/locations', label: 'Локації', ready: false },
      { href: '/admin/prices', label: 'Прайс', ready: false },
    ],
  },
  {
    title: 'Робота',
    tone: 'work',
    screens: [
      { href: '/admin/schedule', label: 'Розклад', ready: false },
      { href: '/admin/subscriptions', label: 'Абонементи', ready: false },
      { href: '/admin/groups', label: 'Групи', ready: false },
      { href: '/admin/students', label: 'Учні', ready: false },
      { href: '/admin/enrollments', label: 'Заявки', ready: false },
    ],
  },
];

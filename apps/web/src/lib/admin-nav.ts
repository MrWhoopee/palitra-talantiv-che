/**
 * Everything the admin cabinet can do, grouped by what it is about.
 *
 * Three groups because the studio's work falls into three: what visitors read,
 * who teaches and for how much, and what happens on a given Tuesday. The
 * grouping is the navigation - a flat list of fifteen links would be a list to
 * read through every time rather than a place to reach for.
 *
 * Every screen here exists. While stage 6 was being built each entry carried a
 * `ready` flag, because a link to a screen that is not there yet is a 404 with
 * the studio's name on it; the last screen took the flag with it.
 */

export type AdminGroupTone = 'site' | 'studio' | 'work';

export interface AdminScreen {
  href: string;
  label: string;
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
      { href: '/admin/pages', label: 'Сторінки' },
      { href: '/admin/contacts', label: 'Контакти' },
      { href: '/admin/events', label: 'Події' },
      { href: '/admin/gallery', label: 'Галерея' },
      { href: '/admin/testimonials', label: 'Відгуки' },
      { href: '/admin/achievements', label: 'Досягнення' },
    ],
  },
  {
    title: 'Студія',
    tone: 'studio',
    screens: [
      { href: '/admin/teachers', label: 'Викладачі' },
      { href: '/admin/directions', label: 'Напрями' },
      { href: '/admin/locations', label: 'Локації' },
      { href: '/admin/prices', label: 'Прайс' },
    ],
  },
  {
    title: 'Робота',
    tone: 'work',
    screens: [
      { href: '/admin/schedule', label: 'Розклад' },
      { href: '/admin/subscriptions', label: 'Абонементи' },
      { href: '/admin/groups', label: 'Групи' },
      { href: '/admin/students', label: 'Учні' },
      { href: '/admin/enrollments', label: 'Заявки' },
    ],
  },
];

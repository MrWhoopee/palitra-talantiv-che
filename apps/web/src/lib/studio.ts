/**
 * Facts about the studio that the interface states in its own voice - the
 * footer, the contacts page, the structured data.
 *
 * Anything the studio has not given us yet is `null` rather than a plausible
 * placeholder, and every consumer renders nothing for a `null`. A made-up phone
 * number on the site of a real studio is worse than no phone number: someone
 * will dial it.
 *
 * The addresses are duplicated from the `Location` rows on purpose. Those rows
 * exist to schedule lessons against; these strings exist to be read. Reading
 * the database for a footer would put an API call on every page of the site.
 */
export const STUDIO = {
  name: 'Палітра талантів',
  city: 'Черкаси',
  since: 2011,
  locations: [
    { name: 'Благовісна', address: 'вул. Благовісна, 170' },
    { name: 'Шевченка', address: 'бул. Шевченка, 276' },
  ],
  phone: null,
  instagram: null,
} as const;

/** Sections in the header. Everything else is reached from the footer. */
export const MAIN_NAV = [
  { href: '/teachers', label: 'Викладачі' },
  { href: '/directions', label: 'Напрями' },
  { href: '/groups', label: 'Групи' },
  { href: '/events', label: 'Події' },
  { href: '/about', label: 'Про нас' },
  { href: '/contacts', label: 'Контакти' },
] as const;

/** Sections that live only in the footer: visitors arrive at them from a page. */
export const FOOTER_NAV = [
  { href: '/gallery', label: 'Галерея' },
  { href: '/achievements', label: 'Досягнення' },
  { href: '/rules', label: 'Правила студії' },
] as const;

/**
 * `"3 200 ₴"`. Grouped by hand rather than through `toLocaleString`, so a
 * price reads the same whatever locale data the machine building the page
 * happens to have, and with a non-breaking space so the amount never wraps
 * away from its currency.
 */
export function formatUah(amount: number): string {
  return `${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}\u00a0₴`;
}

/** `"45 хв"` - the studio writes lesson lengths short. */
export function formatMinutes(minutes: number): string {
  return `${minutes}\u00a0хв`;
}

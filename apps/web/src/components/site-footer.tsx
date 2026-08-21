import Link from 'next/link';
import { Logo } from '@/components/logo';
import { readSiteSettings } from '@/lib/site-content';
import { FOOTER_NAV, MAIN_NAV, STUDIO } from '@/lib/studio';

/**
 * Public pages only - the cabinet ends where its work ends.
 *
 * Contacts the studio has not given us simply do not appear. There are two
 * ways of not having one and they behave the same: a `null` in `STUDIO`, which
 * is what the site was built with, and a row the studio cleared on its own
 * screen, which is how it takes a line back out. Either way nothing is
 * rendered - a footer with a heading and nothing under it reads as broken.
 *
 * The read is cached at the `fetch` level, so this is not a request per page
 * of the site; the cabinet names this page among the ones it changed, which is
 * what replaces the cached copy the moment a contact is edited.
 */
export async function SiteFooter() {
  const settings = await readSiteSettings();

  const phone = settings.phone || STUDIO.phone;
  const email = settings.email || null;
  const workingHours = settings.workingHours || null;
  const socials: { label: string; href: string }[] = [
    { label: 'Instagram', href: settings.instagram || STUDIO.instagram || '' },
    { label: 'Telegram', href: settings.telegram ?? '' },
    { label: 'Facebook', href: settings.facebook ?? '' },
  ].filter((social) => social.href !== '');

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__cols">
          <div className="site-footer__logo">
            <Logo height={34} />
            <p className="eyebrow">
              {STUDIO.city} · з {STUDIO.since}
            </p>
          </div>

          <div>
            <h2>Розділи</h2>
            <ul>
              {[...MAIN_NAV, ...FOOTER_NAV].map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2>Де ми</h2>
            <ul>
              {STUDIO.locations.map((location) => (
                <li key={location.name}>{location.address}</li>
              ))}
              {phone === null ? null : (
                <li>
                  <a href={`tel:${phone}`}>{phone}</a>
                </li>
              )}
              {email === null ? null : (
                <li>
                  <a href={`mailto:${email}`}>{email}</a>
                </li>
              )}
              {workingHours === null ? null : <li>{workingHours}</li>}
            </ul>
          </div>

          {socials.length === 0 ? null : (
            <div>
              <h2>Соцмережі</h2>
              <ul>
                {socials.map((social) => (
                  <li key={social.label}>
                    <a href={social.href}>{social.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="site-footer__note">
          © {STUDIO.since}–{new Date().getFullYear()} {STUDIO.name}. Записуючись на заняття, ви
          погоджуєтесь із <Link href="/rules">правилами студії</Link>.
        </p>
      </div>
    </footer>
  );
}

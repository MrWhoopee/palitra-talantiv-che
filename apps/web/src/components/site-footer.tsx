import Link from 'next/link';
import { Logo } from '@/components/logo';
import { FOOTER_NAV, MAIN_NAV, STUDIO } from '@/lib/studio';

/**
 * Public pages only - the cabinet ends where its work ends.
 *
 * Contacts we do not have yet simply do not appear: `STUDIO.phone` and
 * `STUDIO.instagram` are `null` until the studio hands them over.
 */
export function SiteFooter() {
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
              {STUDIO.phone === null ? null : (
                <li>
                  <a href={`tel:${STUDIO.phone}`}>{STUDIO.phone}</a>
                </li>
              )}
            </ul>
          </div>

          {STUDIO.instagram === null ? null : (
            <div>
              <h2>Соцмережі</h2>
              <ul>
                <li>
                  <a href={STUDIO.instagram}>Instagram</a>
                </li>
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

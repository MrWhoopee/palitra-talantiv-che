import Link from 'next/link';
import { Logo } from '@/components/logo';
import { MAIN_NAV } from '@/lib/studio';

/**
 * The same header on every screen - public pages, cabinet and auth alike - so
 * the mark and the way back home never move.
 *
 * It deliberately does not read the session. Doing so would put an `/auth/me`
 * round trip in front of every public page for the sake of swapping one word,
 * and «Кабінет» works for both cases: a student goes there, a visitor is sent
 * on to the login screen by the middleware.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="site-header__logo" aria-label="Палітра талантів, на головну">
          <Logo />
        </Link>

        <nav className="site-nav" aria-label="Розділи сайту">
          <ul>
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-header__actions">
          <Link href="/teachers" className="button-primary">
            Записатись
          </Link>
          <Link href="/cabinet">Кабінет</Link>
        </div>

        <details className="site-menu">
          <summary aria-label="Меню">
            <span />
            <span />
            <span />
          </summary>
          <div className="site-menu__panel">
            <ul>
              {MAIN_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/cabinet">Кабінет</Link>
              </li>
            </ul>
            <Link href="/teachers" className="button-primary">
              Записатись
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}

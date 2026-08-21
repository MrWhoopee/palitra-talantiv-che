'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_NAV } from '@/lib/admin-nav';

/**
 * The sidebar. A client component only because it needs to know which screen
 * is open - everything else about the shell renders on the server.
 *
 * Each group carries a colour, and each screen a rule in it: the rule is faint
 * until the screen is the one open, and then it fills. It is the same device
 * the site uses for a lesson's length or an event's progress, which is what
 * ties the two halves of the app together without repeating the header here.
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="Розділи адмінки">
      {ADMIN_NAV.map((group) => (
        <div className="admin-nav__group" data-tone={group.tone} key={group.title}>
          <h2 className="admin-nav__title">{group.title}</h2>
          <ul>
            {group.screens.map((screen) => (
              <li key={screen.href}>
                {screen.ready ? (
                  <Link
                    href={screen.href}
                    className="admin-nav__item"
                    aria-current={isOpen(pathname, screen.href) ? 'page' : undefined}
                  >
                    {screen.label}
                  </Link>
                ) : (
                  <span className="admin-nav__item admin-nav__item--soon">
                    {screen.label}
                    <span className="admin-nav__soon">скоро</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** A section is open on its own screen and on everything inside it. */
function isOpen(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

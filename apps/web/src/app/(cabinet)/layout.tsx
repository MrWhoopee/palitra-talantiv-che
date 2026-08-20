import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';
import { LogoutButton } from '@/components/logout-button';
import { getCurrentUser } from '@/lib/current-user';
import '@/styles/site.css';

/**
 * The cabinet keeps the site header and gains a second row under it. No footer:
 * the cabinet ends where the work ends, and the studio's addresses are not what
 * a teacher marking attendance is looking for.
 *
 * The strip is where the cabinet's own navigation now lives - it used to be
 * repeated in the header of every screen inside it.
 */
export default async function CabinetLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const teaching = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  return (
    <div className="site-body">
      <SiteHeader />
      <nav className="cabinet-nav" aria-label="Розділи кабінету">
        <div className="container">
          <ul>
            <li>
              <Link href="/cabinet">Заняття</Link>
            </li>
            {teaching ? (
              <>
                <li>
                  <Link href="/cabinet/schedule">Мій графік</Link>
                </li>
                <li>
                  <Link href="/cabinet/groups">Мої групи</Link>
                </li>
              </>
            ) : (
              <li>
                <Link href="/groups">Групи студії</Link>
              </li>
            )}
            {user === null ? null : (
              <li className="cabinet-nav__end">
                <LogoutButton />
              </li>
            )}
          </ul>
        </div>
      </nav>
      {children}
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminNav } from '@/components/admin-nav';
import { Logo } from '@/components/logo';
import { LogoutButton } from '@/components/logout-button';
import { getCurrentUser } from '@/lib/current-user';
import '@/styles/site.css';
// The field, label and error styles the shared form components render with.
import '@/styles/auth.css';
import '@/styles/admin.css';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * The third guard of the three.
 *
 * The API refuses every `/admin` request without the role, the proxy sends an
 * anonymous visitor to the login screen, and this one decides what a signed-in
 * student sees: nothing. `notFound` rather than a redirect or a message,
 * because "you are not allowed in here" and "there is nothing here" look the
 * same from outside, and the first sentence is an invitation to keep trying.
 *
 * None of the three is load-bearing on its own. The one that actually protects
 * the data is the API's - this one protects the person from a screen full of
 * failed requests.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (user?.role !== 'ADMIN') {
    notFound();
  }

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-side__head">
          <Link href="/" className="admin-side__mark" aria-label="Палітра талантів, на сайт">
            <Logo height={22} />
          </Link>
          <p className="admin-side__role">Адмінка</p>
        </div>

        <AdminNav />

        <div className="admin-side__foot">
          <p className="admin-side__who">
            {user.firstName} {user.lastName}
          </p>
          <Link href="/" className="admin-side__out">
            Переглянути сайт
          </Link>
          <LogoutButton />
        </div>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}

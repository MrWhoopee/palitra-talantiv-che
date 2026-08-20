import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';
import '@/styles/site.css';
import '@/styles/auth.css';

/**
 * No header and no footer: the one thing to do here is finish the form. The
 * mark stays, because it is also the way back out.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Link href="/" className="auth-logo" aria-label="Палітра талантів, на головну">
          <Logo height={26} />
        </Link>
        {children}
      </div>
    </main>
  );
}

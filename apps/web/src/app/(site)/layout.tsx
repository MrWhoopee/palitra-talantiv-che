import type { ReactNode } from 'react';
import { RevealObserver } from '@/components/reveal-observer';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import '@/styles/site.css';

/**
 * The public shell. Pages bring their own `<main>`, so this one does not add a
 * second - it only puts the header above it and the footer below.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-body">
      <SiteHeader />
      {children}
      <SiteFooter />
      <RevealObserver />
    </div>
  );
}

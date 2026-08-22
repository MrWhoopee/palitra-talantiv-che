import { Suspense, type ReactNode } from 'react';
import { PointerLayer } from '@/components/pointer-layer';
import { RevealObserver } from '@/components/reveal-observer';
import { ShowPlayer } from '@/components/show-player';
import { ShowHome } from '@/components/show-home';
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
      <PointerLayer />
      <ShowPlayer />
      {/* The show's home reads which room it is in out of the query string,
          and a client hook that touches URL data would otherwise pull every
          page in this layout out of prerendering. Behind a boundary they stay
          static, which is the promise stage 7 made about /rules and
          /contacts. */}
      <Suspense fallback={null}>
        <ShowHome />
      </Suspense>
    </div>
  );
}

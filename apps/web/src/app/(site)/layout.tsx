import type { ReactNode } from 'react';
import { CurtainCover } from '@/components/curtain-cover';
import { PointerLayer } from '@/components/pointer-layer';
import { RevealObserver } from '@/components/reveal-observer';
import { ShowPlayer } from '@/components/show-player';
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
      <CurtainCover />
    </div>
  );
}

'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/logo';
import { CURTAIN_ATTRIBUTE, isCurtainOpen, readSkin, watchAttributes } from '@/lib/show';

/**
 * The home page's cover: the house curtain, closed, with the studio's mark on
 * it. Play draws it back and the page is behind it; pause draws it shut and
 * the mark comes back.
 *
 * It is a cover rather than a page of its own, which is why it lives over the
 * home page instead of at an address: what is behind the curtain is the real
 * `/`, already rendered, already indexed. Nothing here is content.
 *
 * Velvet is drawn in CSS. three.js would be a hundred and fifty kilobytes on
 * the one page that is measured, for a thing that is on screen for two
 * seconds - it belongs where there is a scene to render, not here.
 */
export function CurtainCover() {
  const pathname = usePathname();
  const [showing, setShowing] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    const read = () => {
      setShowing(readSkin(root) === 'show');
      setOpen(isCurtainOpen(root));
    };

    read();

    return watchAttributes(root, read);
  }, []);

  // Only the home page has a cover so far, and the cover is the home page's.
  if (pathname !== '/' || !showing) return null;

  return (
    <div
      className="curtain"
      data-open={open ? '' : undefined}
      aria-hidden={open ? 'true' : undefined}
    >
      <div className="curtain__half curtain__half--left" />
      <div className="curtain__half curtain__half--right" />

      <div className="curtain__mark">
        <Logo height={64} />
        <p className="curtain__hint">Натисніть ▶, щоб увійти</p>
      </div>
    </div>
  );
}

export { CURTAIN_ATTRIBUTE };

'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShowCorridor } from '@/components/show-corridor';
import { readSkin, watchAttributes } from '@/lib/show';

/**
 * The home page in the show: the studio's corridor, and nothing before it.
 *
 * There was a curtain here, drawn back to reveal the corridor, and it was the
 * wrong gesture twice over. A curtain that opens onto a corridor promises a
 * stage and gives a hallway; and standing in the row of seven doors it made
 * the hall the one track you could not reach the way you reach the others.
 *
 * So the curtain moved to where it belongs - across the stage inside the hall,
 * which is the room behind the first door - and the site opens in the corridor
 * itself. One curtain, and it hides something worth hiding.
 *
 * Not a cover laid over the ordinary page: the ordinary page is not rendered
 * at all while this is on screen, and is still in the HTML for anything that
 * reads rather than looks.
 */
export function ShowHome() {
  const pathname = usePathname();
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    const read = () => setShowing(readSkin(root) === 'show');
    read();

    return watchAttributes(root, read);
  }, []);

  const live = pathname === '/' && showing;

  useEffect(() => {
    if (!live) return;

    const root = document.documentElement;
    root.setAttribute('data-show-home', '');

    return () => root.removeAttribute('data-show-home');
  }, [live]);

  if (!live) return null;

  return <ShowCorridor />;
}

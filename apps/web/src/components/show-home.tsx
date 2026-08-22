'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StageExperience } from '@/components/demo-stage/stage-experience';
import { isCurtainOpen, readSkin, watchAttributes } from '@/lib/show';
import '@/styles/demo-stage.css';

/**
 * The home page in the show: the hall, and nothing else.
 *
 * Not a cover laid over the ordinary page - the ordinary page is not rendered
 * at all while this is on screen. The curtain is the cover, play draws it
 * back, and what is behind it is the stage the scroll then walks across, the
 * whole way, exactly as the demo does it.
 *
 * The transport belongs to the player at the foot of the screen, so the
 * scene is handed its state rather than opening itself on a tap.
 */
export function ShowHome() {
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

  // While the hall is on screen the ordinary page is not: the attribute is
  // what the stylesheet hides it by. CSS cannot know which route this is, and
  // the alternative - a class on a server-rendered element - would mean the
  // shell knowing about the show.
  const live = pathname === '/' && showing;

  useEffect(() => {
    if (!live) return;

    const root = document.documentElement;
    root.setAttribute('data-show-home', '');

    return () => root.removeAttribute('data-show-home');
  }, [live]);

  if (!live) return null;

  return <StageExperience open={open} />;
}

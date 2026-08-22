'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { StageExperience } from '@/components/demo-stage/stage-experience';
import { ShowCorridor } from '@/components/show-corridor';
import { isCurtainOpen, readSkin, setCurtainOpen, watchAttributes } from '@/lib/show';
import { stageFromSearch } from '@/lib/tracks';
import '@/styles/demo-stage.css';

/**
 * The home page in the show: first the curtain, then the studio behind it.
 *
 * Not a cover laid over the ordinary page - the ordinary page is not rendered
 * at all while this is on screen. The curtain is the way in; drawing it back
 * puts you in the corridor the seven rooms open off, and from there a door is
 * an ordinary link to an ordinary page.
 *
 * Which of the two is showing lives in the address (`/` against
 * `/?stage=wall`) rather than in state here, so the browser's back button
 * walks from the corridor to the curtain instead of off the site, and a link
 * to the corridor can be sent to somebody.
 */
export function ShowHome() {
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();
  const [showing, setShowing] = useState(false);
  const [open, setOpen] = useState(false);

  const stage = stageFromSearch(search.get('stage'));

  useEffect(() => {
    const root = document.documentElement;

    const read = () => {
      setShowing(readSkin(root) === 'show');
      setOpen(isCurtainOpen(root));
    };

    read();

    return watchAttributes(root, read);
  }, []);

  // While the show's own home is on screen the ordinary page is not: the
  // attribute is what the stylesheet hides it by. CSS cannot know which route
  // this is, and the alternative - a class on a server-rendered element -
  // would mean the shell knowing about the show.
  const live = pathname === '/' && showing;

  useEffect(() => {
    if (!live) return;

    const root = document.documentElement;
    root.setAttribute('data-show-home', '');

    return () => root.removeAttribute('data-show-home');
  }, [live]);

  // Drawing the curtain back is what opens the studio, so the player's play
  // button ends up here rather than in a second control of its own. Pushed
  // rather than replaced: back is how you get the curtain again.
  useEffect(() => {
    if (!live || stage !== 'curtain' || !open) return;

    router.push('/?stage=wall');
  }, [live, stage, open, router]);

  // In the corridor the curtain is behind you, so the player has to say so.
  //
  // Two things need this and they pull in opposite directions. A link to the
  // corridor has to work when it is sent to somebody, and that visitor arrives
  // with no curtain drawn at all - so arriving sets it, rather than bouncing
  // them back to a curtain they did not ask for. But once it is set, closing
  // it is a person pressing pause, and pause has to lead somewhere: back to
  // the curtain. Telling the two apart is the whole reason for the flag.
  const entered = useRef(false);

  useEffect(() => {
    if (!live || stage !== 'wall') {
      entered.current = false;
      return;
    }

    if (!open) {
      if (entered.current) {
        router.push('/');
        return;
      }

      setCurtainOpen(document.documentElement, true);
      return;
    }

    entered.current = true;
  }, [live, stage, open, router]);

  if (!live) return null;

  return stage === 'wall' ? <ShowCorridor /> : <StageExperience open={open} />;
}

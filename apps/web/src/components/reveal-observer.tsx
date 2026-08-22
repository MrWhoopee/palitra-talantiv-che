'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { revealDelayMs } from '@/lib/reveal';
import { REDUCED_MOTION_QUERY } from '@/lib/skin';

/**
 * Releases sections as they come into view.
 *
 * One observer for the whole page, and no library: `IntersectionObserver` is
 * in every browser we care about, while `animation-timeline: view()` - the
 * CSS answer to the same problem - is Chromium only, and a section that never
 * arrives in Safari is a section that is not there.
 *
 * Renders nothing. It exists so the rest of the site can stay server-rendered:
 * a wrapper around `children` would pull the whole shell into the client.
 */
export function RevealObserver() {
  // A route change swaps the document's contents without unmounting this
  // component, so the sweep has to run again for the page that just arrived.
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;

    // Someone who asked for less motion gets the page as it is. Nothing is
    // armed, so nothing can be left hidden.
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;

    // A grid says once that its rows arrive one after another, rather than
    // every row inside a `map()` saying it for itself. The attribute lands
    // here so that everything below - the hiding rule, the index, the delay -
    // sees one kind of element and not two.
    for (const group of document.querySelectorAll('[data-reveal-group]')) {
      for (const child of group.children) child.setAttribute('data-reveal', '');
    }

    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (nodes.length === 0) return;

    const waiting: HTMLElement[] = [];

    for (const node of nodes) {
      node.style.setProperty('--pt-reveal-delay', `${revealDelayMs(indexInGroup(node))}ms`);

      // Anything already on screen counts as arrived before hiding is armed.
      // Marking it afterwards would show the visitor a flash of the page
      // disappearing and coming back.
      if (node.getBoundingClientRect().top < window.innerHeight * 0.9) {
        node.dataset['seen'] = '';
      } else {
        waiting.push(node);
      }
    }

    root.dataset['revealArmed'] = '';

    if (waiting.length === 0) return () => delete root.dataset['revealArmed'];

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset['seen'] = '';
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15 },
    );

    for (const node of waiting) observer.observe(node);

    return () => {
      observer.disconnect();
      // Disarming on the way out matters: if this component ever stops
      // running, whatever it had hidden must come back rather than stay dark.
      delete root.dataset['revealArmed'];
    };
  }, [pathname]);

  return null;
}

/**
 * Where an element stands among the rows it arrives with.
 *
 * Only inside a container that asked for a stagger; everywhere else a
 * section arrives on its own and waits for nobody.
 */
function indexInGroup(node: HTMLElement): number {
  const parent = node.parentElement;
  if (!parent?.hasAttribute('data-reveal-group')) return 0;

  return Array.from(parent.children).indexOf(node);
}

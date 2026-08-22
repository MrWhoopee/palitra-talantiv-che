import type { Skin } from '@/lib/skin';

/**
 * The two attributes the show is held in, both on `<html>`.
 *
 * `data-skin` is stamped before the first frame by the inline script; the
 * curtain is opened and shut by the player. Keeping both in the document
 * rather than in React state is what lets pieces in different corners of the
 * tree agree without a provider wrapped around the whole server-rendered
 * shell - which is the one thing this site has refused to do since stage 7.
 */
export const SKIN_ATTRIBUTE = 'data-skin';
export const CURTAIN_ATTRIBUTE = 'data-curtain';

/** The only value that means the curtain is drawn back. */
export const CURTAIN_OPEN = 'open';

/** Anything that is not the one word is a closed curtain. */
export function isOpenValue(value: string | null | undefined): boolean {
  return value === CURTAIN_OPEN;
}

export function isCurtainOpen(root: HTMLElement): boolean {
  return isOpenValue(root.getAttribute(CURTAIN_ATTRIBUTE));
}

export function setCurtainOpen(root: HTMLElement, open: boolean): void {
  if (open) {
    root.setAttribute(CURTAIN_ATTRIBUTE, CURTAIN_OPEN);
    return;
  }

  root.removeAttribute(CURTAIN_ATTRIBUTE);
}

export function readSkin(root: HTMLElement): Skin {
  return root.getAttribute(SKIN_ATTRIBUTE) === 'show' ? 'show' : 'calm';
}

/**
 * Calls back whenever either attribute changes, and returns the way to stop.
 *
 * Watched rather than read once: the switch in the footer changes the skin in
 * place, and the player opens the curtain in place. Anything that only looked
 * at mount would be showing the previous answer.
 */
export function watchAttributes(root: HTMLElement, onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);

  observer.observe(root, {
    attributes: true,
    attributeFilter: [SKIN_ATTRIBUTE, CURTAIN_ATTRIBUTE],
  });

  return () => observer.disconnect();
}

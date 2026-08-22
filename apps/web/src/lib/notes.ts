/**
 * The notes that leave anything worth pressing.
 *
 * Glyphs from the page's own font rather than shapes drawn in the shader
 * beside them: text in WebGL means a glyph atlas, and an atlas for four
 * characters is more machinery than the whole effect is worth. They are
 * short-lived elements in the same layer the water is drawn on, and they
 * remove themselves when their animation ends.
 */

const GLYPHS = ['♪', '♫', '♩', '♬'];

/** What a note is worth leaving over. */
const SELECTOR = 'a, button, .card, summary';

/** Two notes from the same element inside this many milliseconds is one. */
const QUIET_MS = 420;

export function startNotes(host: HTMLElement) {
  let lastAt = 0;
  let lastTarget: Element | null = null;

  function onPointerOver(event: PointerEvent) {
    const target = (event.target as Element | null)?.closest(SELECTOR) ?? null;
    if (target === null) return;

    const now = performance.now();
    // Crossing a child element re-fires `pointerover` for the same link, and
    // a burst of notes from one hover reads as a fault rather than a flourish.
    if (target === lastTarget && now - lastAt < QUIET_MS) return;

    lastTarget = target;
    lastAt = now;

    const note = document.createElement('span');
    note.className = 'pointer-note';
    note.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!;
    note.style.left = `${event.clientX}px`;
    note.style.top = `${event.clientY}px`;
    // Two notes leaving the same button on the same path would look printed.
    note.style.setProperty('--pt-note-drift', `${Math.round(Math.random() * 36 - 18)}px`);
    note.addEventListener('animationend', () => note.remove(), { once: true });

    host.append(note);
  }

  document.addEventListener('pointerover', onPointerOver, { passive: true });

  return {
    stop() {
      document.removeEventListener('pointerover', onPointerOver);
      host.replaceChildren();
    },
  };
}

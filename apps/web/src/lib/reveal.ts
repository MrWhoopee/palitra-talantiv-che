/**
 * How a list arrives when it comes into view.
 *
 * Rows follow each other rather than landing together, which is what makes a
 * list read as a list. The stagger is bounded on purpose: past the ceiling
 * every remaining row shares the last delay, so a gallery of forty photos
 * does not end with someone watching an empty grid.
 */

/** One step between neighbouring rows. */
export const REVEAL_STEP_MS = 40;

/** After this many steps the stagger stops widening. */
export const REVEAL_MAX_STEPS = 8;

export function revealDelayMs(index: number): number {
  if (!Number.isFinite(index) || index <= 0) return 0;

  return Math.min(Math.floor(index), REVEAL_MAX_STEPS) * REVEAL_STEP_MS;
}

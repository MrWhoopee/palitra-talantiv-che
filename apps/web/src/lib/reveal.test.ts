import { describe, expect, it } from 'vitest';
import { REVEAL_MAX_STEPS, REVEAL_STEP_MS, revealDelayMs } from './reveal';

describe('revealDelayMs', () => {
  it('lets the first row arrive without waiting', () => {
    expect(revealDelayMs(0)).toBe(0);
  });

  it('walks down a list one step at a time', () => {
    expect(revealDelayMs(1)).toBe(REVEAL_STEP_MS);
    expect(revealDelayMs(3)).toBe(REVEAL_STEP_MS * 3);
  });

  it('stops widening the gap after the last step', () => {
    // A ninth row that waits half a second for its turn reads as a site
    // thinking, not as a site with manners.
    const ceiling = REVEAL_STEP_MS * REVEAL_MAX_STEPS;

    expect(revealDelayMs(REVEAL_MAX_STEPS)).toBe(ceiling);
    expect(revealDelayMs(REVEAL_MAX_STEPS + 1)).toBe(ceiling);
    expect(revealDelayMs(400)).toBe(ceiling);
  });

  it('treats an index that is not a whole count as the first row', () => {
    expect(revealDelayMs(-3)).toBe(0);
    expect(revealDelayMs(Number.NaN)).toBe(0);
    expect(revealDelayMs(1.5)).toBe(REVEAL_STEP_MS);
  });
});

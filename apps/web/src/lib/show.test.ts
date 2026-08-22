import { describe, expect, it } from 'vitest';
import { CURTAIN_OPEN, isOpenValue } from './show';

describe('isOpenValue', () => {
  it('opens on the one word that means it', () => {
    expect(isOpenValue(CURTAIN_OPEN)).toBe(true);
  });

  it('keeps the curtain shut for anything else', () => {
    // The attribute is absent far more often than it is wrong, and both mean
    // the same thing: the cover is what the visitor is looking at.
    expect(isOpenValue(null)).toBe(false);
    expect(isOpenValue(undefined)).toBe(false);
    expect(isOpenValue('')).toBe(false);
    expect(isOpenValue('Open')).toBe(false);
    expect(isOpenValue('true')).toBe(false);
  });
});

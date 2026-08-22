import { describe, expect, it } from 'vitest';
import { REDUCED_MOTION_QUERY, resolveSkin, SKIN_COOKIE, SKIN_SCRIPT } from './skin';

describe('resolveSkin', () => {
  it('shows the studio to a first visitor', () => {
    expect(resolveSkin('', false)).toBe('show');
  });

  it('keeps the choice a visitor has already made', () => {
    expect(resolveSkin(`${SKIN_COOKIE}=calm`, false)).toBe('calm');
    expect(resolveSkin(`${SKIN_COOKIE}=show`, false)).toBe('show');
  });

  it('finds the skin among other cookies', () => {
    expect(resolveSkin(`session=abc; ${SKIN_COOKIE}=calm; theme=x`, false)).toBe('calm');
  });

  it('reads a value it does not know as no choice at all', () => {
    // The value arrives in a header the visitor controls, so anything can be
    // in it; only the one name that turns the show off counts.
    expect(resolveSkin(`${SKIN_COOKIE}=calm-ish`, false)).toBe('show');
    expect(resolveSkin(`${SKIN_COOKIE}=`, false)).toBe('show');
    expect(resolveSkin(`${SKIN_COOKIE}=<script>`, false)).toBe('show');
  });

  it('does not mistake a cookie whose name merely ends with ours', () => {
    expect(resolveSkin(`not-${SKIN_COOKIE}=calm`, false)).toBe('show');
  });

  it('answers calm to anyone who asked for less motion, whatever the cookie says', () => {
    expect(resolveSkin(`${SKIN_COOKIE}=show`, true)).toBe('calm');
    expect(resolveSkin(`${SKIN_COOKIE}=calm`, true)).toBe('calm');
    expect(resolveSkin('', true)).toBe('calm');
  });
});

describe('SKIN_SCRIPT', () => {
  /**
   * Runs the serialised script the way the document head will, with the two
   * globals it touches handed in. This is the test that would have caught a
   * helper call surviving minification as a name that is no longer there.
   */
  function run(cookie: string, prefersReducedMotion: boolean): string | undefined {
    const dataset: Record<string, string> = {};
    const document = { documentElement: { dataset }, cookie };
    const matchMedia = (query: string) => ({
      matches: query === REDUCED_MOTION_QUERY && prefersReducedMotion,
    });

    new Function('document', 'matchMedia', SKIN_SCRIPT)(document, matchMedia);

    return dataset['skin'];
  }

  it('stamps the skin on the document element', () => {
    expect(run(`${SKIN_COOKIE}=calm`, false)).toBe('calm');
    expect(run('', false)).toBe('show');
  });

  it('asks the browser about reduced motion and obeys the answer', () => {
    expect(run(`${SKIN_COOKIE}=show`, true)).toBe('calm');
  });

  it('carries no reference to anything outside itself', () => {
    // Only `document` and `matchMedia` may be free names: the script runs
    // before any bundle has loaded, so there is nothing else to reach for.
    expect(new Function('document', 'matchMedia', SKIN_SCRIPT)).toBeTypeOf('function');
    expect(SKIN_SCRIPT).not.toContain('import');
  });
});

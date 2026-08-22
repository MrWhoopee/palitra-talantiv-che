import { describe, expect, it } from 'vitest';
import { neighbours, TRACKS, trackAt, trackIndex } from './tracks';

describe('TRACKS', () => {
  it('opens with the home page and then reads the menu top to bottom', () => {
    // The order is the menu's own. A second list would be a second place to
    // change it, and the two would drift.
    expect(TRACKS[0]?.href).toBe('/');
    expect(TRACKS.map((track) => track.href)).toEqual([
      '/',
      '/teachers',
      '/directions',
      '/groups',
      '/events',
      '/about',
      '/contacts',
    ]);
  });
});

describe('trackIndex', () => {
  it('finds the track a page belongs to', () => {
    expect(trackIndex('/')).toBe(0);
    expect(trackIndex('/teachers')).toBe(1);
    expect(trackIndex('/contacts')).toBe(6);
  });

  it('keeps a page inside the track it was reached from', () => {
    // A teacher's own page is still the teachers track: the player has to go
    // on saying where the visitor is rather than losing them one click in.
    expect(trackIndex('/teachers/019ffcad-80f9')).toBe(1);
    expect(trackIndex('/events/demo-zvitnyi-kontsert')).toBe(4);
  });

  it('matches the home page exactly and nothing else', () => {
    // Every path starts with a slash; a prefix match on "/" would put the
    // whole site inside the first track.
    expect(trackIndex('/gallery')).toBeNull();
    expect(trackIndex('/achievements')).toBeNull();
    expect(trackIndex('/cabinet')).toBeNull();
  });

  it('is not fooled by a path that merely starts with a track name', () => {
    expect(trackIndex('/teachers-archive')).toBeNull();
  });

  it('ignores a trailing slash and a query string', () => {
    expect(trackIndex('/teachers/')).toBe(1);
    expect(trackIndex('/?stage=wall')).toBe(0);
  });
});

describe('neighbours', () => {
  it('walks the list without wrapping', () => {
    // The player says "track 7 of 7". A seventh that leads to the first would
    // contradict its own caption.
    expect(neighbours(0).previous).toBeNull();
    expect(neighbours(0).next?.href).toBe('/teachers');

    expect(neighbours(6).previous?.href).toBe('/about');
    expect(neighbours(6).next).toBeNull();
  });

  it('gives both sides in the middle', () => {
    expect(neighbours(3).previous?.href).toBe('/directions');
    expect(neighbours(3).next?.href).toBe('/events');
  });

  it('offers the way in from a page that is not a track', () => {
    // The gallery has no place in the list, so there is nothing behind it -
    // but somebody who arrived there still needs a way back into the menu.
    expect(neighbours(null).previous).toBeNull();
    expect(neighbours(null).next?.href).toBe('/');
  });
});

describe('trackAt', () => {
  it('answers with the track and its human number', () => {
    expect(trackAt(1)).toEqual({ track: TRACKS[1], number: 2, total: 7 });
  });

  it('answers with nothing outside the list', () => {
    expect(trackAt(null)).toBeNull();
    expect(trackAt(99)).toBeNull();
    expect(trackAt(-1)).toBeNull();
  });
});

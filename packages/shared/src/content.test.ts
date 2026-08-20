import { describe, expect, it } from 'vitest';
import {
  eventSharePercent,
  lessonSharePercent,
  playbillDayStart,
  youtubeEmbedUrl,
} from './content';

describe('lessonSharePercent', () => {
  it('reads a lesson against the hour', () => {
    expect(lessonSharePercent(30)).toBe(50);
    expect(lessonSharePercent(45)).toBe(75);
    expect(lessonSharePercent(60)).toBe(100);
  });

  it('never overruns the track', () => {
    expect(lessonSharePercent(90)).toBe(100);
    expect(lessonSharePercent(-10)).toBe(0);
  });
});

describe('eventSharePercent', () => {
  const start = new Date('2026-09-12T15:00:00Z');
  const end = new Date('2026-09-12T17:00:00Z');

  it('fills as the event runs', () => {
    expect(eventSharePercent(start, end, new Date('2026-09-12T14:00:00Z'))).toBe(0);
    expect(eventSharePercent(start, end, new Date('2026-09-12T16:00:00Z'))).toBe(50);
    expect(eventSharePercent(start, end, new Date('2026-09-12T20:00:00Z'))).toBe(100);
  });

  it('is empty or full for an event with no end time', () => {
    expect(eventSharePercent(start, null, new Date('2026-09-12T14:59:00Z'))).toBe(0);
    expect(eventSharePercent(start, null, new Date('2026-09-12T15:01:00Z'))).toBe(100);
  });
});

describe('playbillDayStart', () => {
  /**
   * The case that decides where an evening concert with no end time is shown.
   * At 23:00 Kyiv time it is already tomorrow in UTC+0 terms only by an hour -
   * the day the studio is living in has not ended, and neither has the event.
   */
  it('is Kyiv midnight, not UTC midnight', () => {
    // 2026-09-12T22:30Z is 01:30 on the 13th in Kyiv (UTC+3 in summer).
    expect(playbillDayStart(new Date('2026-09-12T22:30:00Z')).toISOString()).toBe(
      '2026-09-12T21:00:00.000Z',
    );

    // 2026-09-12T20:30Z is 23:30 on the 12th - still the studio's Saturday.
    expect(playbillDayStart(new Date('2026-09-12T20:30:00Z')).toISOString()).toBe(
      '2026-09-11T21:00:00.000Z',
    );
  });

  it('follows the zone across the autumn change', () => {
    // Winter time: Kyiv is UTC+2, so midnight is 22:00 the previous day.
    expect(playbillDayStart(new Date('2026-11-15T12:00:00Z')).toISOString()).toBe(
      '2026-11-14T22:00:00.000Z',
    );
  });
});

describe('youtubeEmbedUrl', () => {
  const embed = 'https://www.youtube.com/embed/dQw4w9WgXcQ';

  it('accepts the three forms the studio is likely to paste', () => {
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(embed);
    expect(youtubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(embed);
    expect(youtubeEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(embed);
  });

  it('keeps the timestamp off, because the embed is not a resumed watch', () => {
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42')).toBe(embed);
  });

  it('refuses anything that is not a YouTube video', () => {
    expect(youtubeEmbedUrl('https://vimeo.com/12345678')).toBeNull();
    expect(youtubeEmbedUrl('/demo/gallery-1.svg')).toBeNull();
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=../../evil')).toBeNull();
    expect(youtubeEmbedUrl('javascript:alert(1)')).toBeNull();
  });
});

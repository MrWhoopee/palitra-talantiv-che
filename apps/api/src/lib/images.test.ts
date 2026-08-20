import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { prepareImage } from './images';

/**
 * The pipeline runs against real images rather than mocked buffers: what is
 * being tested is what `sharp` decides, and a mock would only assert that we
 * called it the way we already believe we call it.
 */
async function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } },
  })
    .jpeg()
    .toBuffer();
}

describe('prepareImage', () => {
  it('shrinks a photo from a phone to fit the long edge', async () => {
    const { data } = await prepareImage(await jpeg(4032, 3024), 'gallery');

    const meta = await sharp(data).metadata();
    expect(meta.width).toBe(1600);
    expect(meta.height).toBe(1200);
  });

  it('shrinks by the long edge whichever side that is', async () => {
    const { data } = await prepareImage(await jpeg(1080, 2400), 'gallery');

    const meta = await sharp(data).metadata();
    expect(meta.height).toBe(1600);
  });

  it('leaves a small image at its own size', async () => {
    const { data } = await prepareImage(await jpeg(600, 400), 'gallery');

    const meta = await sharp(data).metadata();
    // Enlarging it would cost bytes and add nothing: the pixels are not there.
    expect(meta.width).toBe(600);
  });

  it('converts to webp whatever came in', async () => {
    const png = await sharp({
      create: { width: 100, height: 100, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();

    const { data } = await prepareImage(png, 'gallery');

    expect((await sharp(data).metadata()).format).toBe('webp');
  });

  it('drops the metadata the camera wrote', async () => {
    const withExif = await sharp(await jpeg(800, 600))
      .withExif({ IFD0: { Copyright: 'Somebody', Software: 'a phone' } })
      .toBuffer();

    const { data } = await prepareImage(withExif, 'gallery');

    // A photo from a school concert carries the GPS of the school in it.
    expect((await sharp(data).metadata()).exif).toBeUndefined();
  });

  it('makes a thumbnail for the gallery', async () => {
    const { thumb } = await prepareImage(await jpeg(2000, 1500), 'gallery');

    expect(thumb).toBeDefined();
    expect((await sharp(thumb!).metadata()).width).toBe(480);
  });

  it('makes no thumbnail for a single cover', async () => {
    const { thumb } = await prepareImage(await jpeg(2000, 1500), 'cover');

    // Nothing shows covers in a grid, so a second file would be dead weight.
    expect(thumb).toBeUndefined();
  });

  it('refuses a file that is not an image', async () => {
    await expect(prepareImage(Buffer.from('#!/bin/sh\nrm -rf /'), 'cover')).rejects.toThrow();
  });

  it('refuses a PDF renamed to look like a photo', async () => {
    // What the browser called it is not evidence; the bytes are.
    await expect(prepareImage(Buffer.from('%PDF-1.7\n%âãÏÓ'), 'cover')).rejects.toThrow();
  });
});

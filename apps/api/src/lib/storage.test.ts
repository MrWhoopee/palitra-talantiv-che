import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLocalDiskStorage, type StorageAdapter } from './storage';

const PUBLIC_BASE = 'http://localhost:4000/uploads';

let dir: string;
let storage: StorageAdapter;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'palitra-uploads-'));
  storage = createLocalDiskStorage({ dir, publicBaseUrl: PUBLIC_BASE });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Whatever the pipeline hands over; the adapter does not look inside it. */
const bytes = Buffer.from('webp-ish bytes');

function fileNameOf(url: string): string {
  return url.slice(`${PUBLIC_BASE}/`.length);
}

describe('local disk storage', () => {
  it('writes the file and returns the address it is served at', async () => {
    const { url } = await storage.save({ data: bytes });

    expect(url.startsWith(`${PUBLIC_BASE}/`)).toBe(true);
    expect(await readFile(join(dir, fileNameOf(url)))).toEqual(bytes);
  });

  it('gives every upload its own name', async () => {
    const first = await storage.save({ data: bytes });
    const second = await storage.save({ data: bytes });

    // Two people uploading "photo.jpg" must not overwrite each other.
    expect(first.url).not.toBe(second.url);
  });

  it('stores a thumbnail beside the image when one is given', async () => {
    const saved = await storage.save({ data: bytes, thumb: Buffer.from('small') });

    expect(saved.thumbUrl).toBeDefined();
    expect(await readFile(join(dir, fileNameOf(saved.thumbUrl!)))).toEqual(Buffer.from('small'));
  });

  it('deletes the file and its thumbnail', async () => {
    const saved = await storage.save({ data: bytes, thumb: Buffer.from('small') });

    await storage.remove(saved.url);

    expect(await readdir(dir)).toEqual([]);
  });

  it('says nothing when asked to delete what is already gone', async () => {
    const saved = await storage.save({ data: bytes });
    await storage.remove(saved.url);

    // Replacing a picture twice must not turn into a 500 the second time.
    await expect(storage.remove(saved.url)).resolves.toBeUndefined();
  });

  it('ignores a link that does not belong to this storage', async () => {
    await storage.save({ data: bytes });

    await storage.remove('https://instagram.example/photo.webp');

    // Seed rows hold links to somewhere else entirely; deleting such a row
    // must not reach for a local file, and must not throw either.
    expect(await readdir(dir)).toHaveLength(1);
  });

  it('refuses to walk out of the uploads directory', async () => {
    const outside = join(dir, '..', `palitra-not-ours-${process.pid}.txt`);
    const name = outside.split(/[\\/]/).at(-1)!;
    await writeFile(outside, 'someone elses file');

    try {
      await storage.remove(`${PUBLIC_BASE}/../${name}`);
      await storage.remove(`${PUBLIC_BASE}/${encodeURIComponent(`../${name}`)}`);

      // The url is a string out of the database. If a row ever holds a crafted
      // one, deleting that row must not delete something else on the disk.
      expect(await readFile(outside, 'utf8')).toBe('someone elses file');
    } finally {
      await rm(outside, { force: true });
    }
  });
});

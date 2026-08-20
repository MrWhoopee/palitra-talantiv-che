import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface SaveInput {
  data: Buffer;
  /** A gallery item ships a second, smaller file; everything else does not. */
  thumb?: Buffer | undefined;
}

export interface StoredFile {
  url: string;
  thumbUrl?: string | undefined;
}

/**
 * Where uploaded pictures live.
 *
 * The interface exists ahead of a second implementation on purpose: the design
 * doc defers the hosting decision to stage 8, and a local directory is the
 * wrong answer on a platform with an ephemeral filesystem. When that decision
 * is made, an S3 driver goes behind this and nothing above it changes.
 */
export interface StorageAdapter {
  save(input: SaveInput): Promise<StoredFile>;
  /** Idempotent, and silent about links that were never ours. */
  remove(url: string): Promise<void>;
}

export interface LocalDiskStorageOptions {
  dir: string;
  /** Where the same directory is reachable from a browser. */
  publicBaseUrl: string;
}

const THUMB_SUFFIX = '-thumb';
const EXTENSION = '.webp';

export function createLocalDiskStorage({
  dir,
  publicBaseUrl,
}: LocalDiskStorageOptions): StorageAdapter {
  const base = publicBaseUrl.replace(/\/+$/, '');

  return {
    async save({ data, thumb }): Promise<StoredFile> {
      await mkdir(dir, { recursive: true });

      // A random name rather than the one the browser sent: two people
      // uploading `photo.jpg` would otherwise overwrite each other, and an
      // uploaded name is attacker-controlled text on the way to a filesystem.
      const name = randomUUID();

      await writeFile(join(dir, `${name}${EXTENSION}`), data);
      if (!thumb) {
        return { url: `${base}/${name}${EXTENSION}` };
      }

      await writeFile(join(dir, `${name}${THUMB_SUFFIX}${EXTENSION}`), thumb);
      return {
        url: `${base}/${name}${EXTENSION}`,
        thumbUrl: `${base}/${name}${THUMB_SUFFIX}${EXTENSION}`,
      };
    },

    async remove(url): Promise<void> {
      const name = localNameOf(url, base);
      if (!name) {
        return;
      }

      const stem = name.slice(0, -EXTENSION.length);
      await rm(join(dir, name), { force: true });
      await rm(join(dir, `${stem}${THUMB_SUFFIX}${EXTENSION}`), { force: true });
    },
  };
}

/**
 * The file name inside our directory, or nothing.
 *
 * Nothing is the answer for a link that points somewhere else - the seed rows
 * hold plain external addresses, and deleting such a row must not go looking
 * on the disk. Nothing is also the answer for a name that is not a plain name:
 * this string comes out of the database, and if a crafted one ever gets in
 * there, `remove` must not become a way to delete an arbitrary file.
 */
function localNameOf(url: string, base: string): string | null {
  if (!url.startsWith(`${base}/`)) {
    return null;
  }

  const raw = url.slice(base.length + 1);
  const name = safeDecode(raw);
  if (name === null) {
    return null;
  }

  const looksLikeOurs = /^[A-Za-z0-9-]+\.webp$/.test(name);
  return looksLikeOurs ? name : null;
}

function safeDecode(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

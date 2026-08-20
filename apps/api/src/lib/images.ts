import sharp from 'sharp';
import { DomainError } from '../http/error-handler';

/**
 * What an uploaded picture is for. It decides one thing today - whether a
 * thumbnail is worth making - and exists as a name rather than a boolean so
 * that the call sites read as what they are uploading.
 */
export type UploadKind = 'gallery' | 'cover' | 'portrait';

/** The long edge of the stored image. */
const MAX_EDGE = 1600;

/** The long edge of a gallery thumbnail: three across on a phone. */
const THUMB_EDGE = 480;

const QUALITY = 80;

export interface PreparedImage {
  data: Buffer;
  thumb?: Buffer;
}

/**
 * Everything that happens to a picture between the upload form and the disk.
 *
 * A photo straight from a phone is four to six megabytes, and the site earned
 * its Lighthouse score on hand-picked links. Serving those files as they
 * arrive would undo that on the first real gallery, so the size is decided
 * here rather than left to whoever is uploading.
 *
 * The format is read from the bytes, never from what the browser said it was
 * sending: `Content-Type` is a claim by the client, and a claim is not
 * evidence. Anything `sharp` cannot decode is rejected here, which is also
 * what keeps a renamed PDF or a shell script out of the uploads directory.
 */
export async function prepareImage(input: Buffer, kind: UploadKind): Promise<PreparedImage> {
  await assertDecodable(input);

  // `rotate()` with no argument applies the EXIF orientation before the tag is
  // dropped. Without it, every portrait photo from a phone lands on its side.
  const base = sharp(input).rotate().resize({
    width: MAX_EDGE,
    height: MAX_EDGE,
    fit: 'inside',
    withoutEnlargement: true,
  });

  const data = await base.clone().webp({ quality: QUALITY }).toBuffer();

  if (kind !== 'gallery') {
    return { data };
  }

  const thumb = await base
    .clone()
    .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();

  return { data, thumb };
}

async function assertDecodable(input: Buffer): Promise<void> {
  try {
    const { format } = await sharp(input).metadata();
    if (!format) {
      throw new Error('no format');
    }
  } catch {
    throw new DomainError('VALIDATION_FAILED', 'Файл не є зображенням');
  }
}

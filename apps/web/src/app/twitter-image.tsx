import { OG_ALT, OG_CONTENT_TYPE, OG_SIZE, renderMarkImage } from '@/lib/og-image';

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** The same card again: Twitter does not fall back to the Open Graph one. */
export default function TwitterImage() {
  return renderMarkImage();
}

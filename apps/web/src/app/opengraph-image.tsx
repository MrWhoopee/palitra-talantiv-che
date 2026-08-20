import { OG_ALT, OG_CONTENT_TYPE, OG_SIZE, renderMarkImage } from '@/lib/og-image';

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** The site-wide default card. A page with a picture of its own overrides it. */
export default function OpengraphImage() {
  return renderMarkImage();
}

import { youtubeEmbedUrl, type GalleryItem } from '@palitra/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import { openGraphFor } from '@/lib/seo';
import '@/styles/content.css';

const TITLE = 'Галерея — Палітра талантів';
const DESCRIPTION = 'Фото й відео з концертів і занять музичної студії «Палітра талантів».';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/gallery' },
  openGraph: openGraphFor({ title: TITLE, description: DESCRIPTION, path: '/gallery' }),
};

export const dynamic = 'force-dynamic';

/**
 * Photographs and video from the studio's own events. Until the studio sends
 * its archive this is what the seed puts there, and an empty gallery says so
 * instead of showing a grid of frames.
 */
export default async function GalleryPage() {
  const items = await api.getGallery().catch(() => [] as GalleryItem[]);

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Як це виглядає</p>
        <h1 className="page-title">Галерея</h1>
        <p className="page-lede">Концерти, відкриті уроки й будні студії.</p>
      </header>

      {items.length === 0 ? (
        <p className="empty-state">
          Галерея наповнюється. Найближчі виступи — в <Link href="/events">афіші</Link>.
        </p>
      ) : (
        <ul className="gallery">
          {items.map((item) => (
            <li key={item.id} className="gallery__item">
              <GalleryFrame item={item} />
              {item.caption === null && item.eventSlug === null ? null : (
                <p className="gallery__caption">
                  {item.caption}
                  {item.eventSlug === null ? null : (
                    <>
                      {item.caption === null ? null : ' · '}
                      <Link href={`/events/${item.eventSlug}`}>подія</Link>
                    </>
                  )}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/**
 * A photograph is an image; a video is a YouTube embed. A link the parser does
 * not recognise as a video becomes a plain link rather than an `<iframe>` to
 * an address nobody checked.
 */
function GalleryFrame({ item }: { item: GalleryItem }) {
  if (item.kind === 'PHOTO') {
    // A plain <img> for the same reason as the event cover: these are links
    // the studio supplies, with no dimensions and no host known in advance.
    return (
      <img className="gallery__media" src={item.url} alt={item.caption ?? ''} loading="lazy" />
    );
  }

  const embed = youtubeEmbedUrl(item.url);

  if (embed === null) {
    return (
      <a className="gallery__fallback" href={item.url} rel="noreferrer">
        Дивитися відео →
      </a>
    );
  }

  return (
    <iframe
      className="gallery__media"
      src={embed}
      title={item.caption ?? 'Відео студії'}
      loading="lazy"
      allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  );
}

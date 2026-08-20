import { ImageResponse } from 'next/og';

/**
 * The picture that shows up when someone pastes a link to the studio into a
 * chat. It is the mark itself - the wordmark with the player track under it -
 * drawn rather than loaded, because the SVG in `public/` is not a format the
 * scrapers render.
 *
 * Everything on it is Latin. The generator falls back to the one font it
 * bundles, which has no Cyrillic, so a Ukrainian line here would come out as
 * a row of empty boxes on every social card the studio ever posts.
 */

export const OG_SIZE = { width: 1200, height: 630 };

export const OG_ALT = 'Палітра талантів — музична студія в Черкасах';

export const OG_CONTENT_TYPE = 'image/png';

const PAPER = '#f1f1f9';
const VIOLET = '#7546d0';
const PINE = '#3a5b4a';

/** Where the playhead sits in the original avatar, measured off it. */
const PLAYHEAD = 88;

export function renderMarkImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: PAPER,
        color: VIOLET,
      }}
    >
      <div style={{ display: 'flex', fontSize: 132, letterSpacing: 2 }}>PALITRA</div>
      <div style={{ display: 'flex', fontSize: 72, letterSpacing: 5.5, marginTop: 8 }}>
        TALANTIV
      </div>

      <div
        style={{
          position: 'relative',
          display: 'flex',
          width: 520,
          height: 8,
          marginTop: 56,
          borderRadius: 4,
          background: '#d7d7e6',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: `${PLAYHEAD}%`,
            height: '100%',
            borderRadius: 4,
            background: PINE,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${PLAYHEAD}%`,
            top: -8,
            display: 'flex',
            width: 24,
            height: 24,
            marginLeft: -12,
            borderRadius: 12,
            background: PINE,
          }}
        />
      </div>

      <div style={{ display: 'flex', marginTop: 56, fontSize: 26, letterSpacing: 4, color: PINE }}>
        CHERKASY · SINCE 2011
      </div>
    </div>,
    OG_SIZE,
  );
}

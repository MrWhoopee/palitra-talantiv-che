import type { Metadata } from 'next';
import { Onest, Rubik } from 'next/font/google';
import type { ReactNode } from 'react';
import { SITE_URL } from '@/lib/seo';
import { SKIN_SCRIPT } from '@/lib/skin';
import '../styles/globals.css';

/**
 * The logo is set in Jost, which has no Ukrainian letters at all - `і`, `ї` and
 * `є` are `.notdef`. Rubik carries the same circular geometry and does have
 * them, so headings rhyme with the mark instead of fighting it.
 */
const rubik = Rubik({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--pt-font-display-loaded',
  display: 'swap',
});

const onest = Onest({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--pt-font-body-loaded',
  display: 'swap',
});

const TITLE = 'Палітра талантів — музична студія в Черкасах';
const DESCRIPTION =
  'Вокал, фортепіано, гітара та укулеле для дітей і дорослих. Індивідуальні та групові заняття.';

/**
 * The defaults every page inherits. `metadataBase` is what turns the relative
 * canonical links the pages declare into absolute ones - without it Next has
 * no way to know which host it is being served from, and every canonical would
 * be dropped.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Палітра талантів',
    locale: 'uk_UA',
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // `suppressHydrationWarning` is here for exactly one attribute: the inline
  // script below stamps `data-skin` before React hydrates, so the server HTML
  // and the live document differ by design. Without it React reports a
  // mismatch on every page load - and a warning that is always there is a
  // warning nobody reads when it finally means something.
  return (
    <html lang="uk" className={`${rubik.variable} ${onest.variable}`} suppressHydrationWarning>
      <head>
        {/*
          Stamps `data-skin` before the first frame. It runs here rather than
          on the server because `cookies()` in this layout would make every
          page dynamic, and /rules and /contacts are static - the copy the
          studio writes is cached and rebuilt when the cabinet says so, not
          fetched again for every visitor.
        */}
        <script dangerouslySetInnerHTML={{ __html: SKIN_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

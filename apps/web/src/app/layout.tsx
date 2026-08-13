import type { Metadata } from 'next';
import { Onest, Unbounded } from 'next/font/google';
import type { ReactNode } from 'react';
import '../styles/globals.css';

const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--pt-font-display-loaded',
  display: 'swap',
});

const onest = Onest({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--pt-font-body-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Палітра талантів — музична студія в Черкасах',
  description:
    'Вокал, фортепіано, гітара та укулеле для дітей і дорослих. Індивідуальні та групові заняття.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk" className={`${unbounded.variable} ${onest.variable}`}>
      <body>{children}</body>
    </html>
  );
}

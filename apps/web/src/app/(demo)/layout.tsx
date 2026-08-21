import type { ReactNode } from 'react';
import '@/styles/demo-stage.css';

/**
 * The demo shell. No header, no footer: these pages are experiments that take
 * the whole window, and the site chrome would be furniture inside a room that
 * is not the site.
 */
export default function DemoLayout({ children }: { children: ReactNode }) {
  return children;
}

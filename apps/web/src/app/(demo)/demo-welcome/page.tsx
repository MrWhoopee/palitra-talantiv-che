import type { Metadata } from 'next';
import { StageExperience } from '@/components/demo-stage/stage-experience';

/**
 * A sketch of an opening: a curtain over the studio mark, and a stage behind it
 * that the scroll walks across. Everything on it is a placeholder - the
 * instruments are built from primitives and the copy is invented - because the
 * question this page exists to answer is whether the idea works at all, not
 * whether the piano has the right number of strings.
 *
 * It is deliberately kept away from the real site: nothing under (site) imports
 * it, and three.js only ever reaches the browser on this route.
 */
export const metadata: Metadata = {
  title: 'Демо: завіса',
  description: 'Чернетка головної сторінки зі сценою, завісою та інструментами.',
  robots: { index: false, follow: false },
};

export default function DemoWelcomePage() {
  return <StageExperience />;
}

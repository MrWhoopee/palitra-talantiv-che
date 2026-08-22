import type { Metadata } from 'next';
import { DemoCorridor } from '@/components/demo-corridor';

/**
 * The seven doors, before the corridor becomes the show's own wall.
 */
export const metadata: Metadata = {
  title: 'Демо: коридор',
  description: 'Сім дверей студії та крок між ними.',
  robots: { index: false, follow: false },
};

export default function DemoCorridorPage() {
  return <DemoCorridor />;
}

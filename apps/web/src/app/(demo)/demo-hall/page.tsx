import type { Metadata } from 'next';
import { DemoHall } from '@/components/demo-hall';

/** The auditorium behind the first door, while its curtain is still to come. */
export const metadata: Metadata = {
  title: 'Демо: зала',
  description: 'Глядацька зала студії та сцена.',
  robots: { index: false, follow: false },
};

export default function DemoHallPage() {
  return <DemoHall />;
}

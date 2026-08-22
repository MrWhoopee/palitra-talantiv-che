import type { Metadata } from 'next';
import { DemoProps } from '@/components/demo-props';

/**
 * Every prop in `props.glb`, stood under the show's own light and turned.
 *
 * The bench for the model library: what `pnpm assets:props` produced, seen
 * the way a visitor would see it rather than the way Blender shows it.
 */
export const metadata: Metadata = {
  title: 'Демо: реквізит',
  description: 'Бібліотека моделей вистави під світлом сцени.',
  robots: { index: false, follow: false },
};

export default function DemoPropsPage() {
  return <DemoProps />;
}

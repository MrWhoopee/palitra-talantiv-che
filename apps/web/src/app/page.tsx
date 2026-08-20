import type { HealthResponse } from '@palitra/shared';
import Link from 'next/link';
import { api } from '@/lib/api';
import '../styles/booking.css';

export const dynamic = 'force-dynamic';

async function loadHealth(): Promise<HealthResponse | null> {
  try {
    return await api.getHealth();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const health = await loadHealth();

  return (
    <main
      style={{
        maxWidth: 'var(--pt-container)',
        margin: '0 auto',
        padding: 'var(--pt-space-9) var(--pt-space-5)',
      }}
    >
      <p
        style={{
          margin: `0 0 var(--pt-space-4)`,
          color: 'var(--pt-primary)',
          fontSize: 'var(--pt-text-sm)',
          fontWeight: 700,
          letterSpacing: 'var(--pt-tracking-wide)',
          textTransform: 'uppercase',
        }}
      >
        Черкаси · з 2011 року
      </p>

      <h1 style={{ fontSize: 'var(--pt-text-3xl)', maxWidth: '18ch' }}>Палітра талантів</h1>

      <p
        style={{
          maxWidth: '42ch',
          margin: 'var(--pt-space-5) 0 var(--pt-space-7)',
          color: 'var(--pt-text-muted)',
          fontSize: 'var(--pt-text-lg)',
        }}
      >
        Вокал, фортепіано, гітара та укулеле — для дітей і дорослих.
      </p>

      <p
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--pt-space-4)',
          margin: '0 0 var(--pt-space-8)',
        }}
      >
        <Link href="/teachers" className="button-primary">
          Обрати викладача — перше заняття безкоштовне
        </Link>
        <Link href="/groups" className="button-quiet">
          Групи та ансамблі
        </Link>
      </p>

      <section
        style={{
          background: 'var(--pt-surface)',
          border: `1px solid var(--pt-line)`,
          borderRadius: 'var(--pt-radius-lg)',
          boxShadow: 'var(--pt-shadow-md)',
          padding: 'var(--pt-space-6)',
        }}
      >
        <h2 style={{ fontSize: 'var(--pt-text-lg)' }}>Стан системи</h2>
        <p style={{ margin: 'var(--pt-space-3) 0 0', color: 'var(--pt-text-muted)' }}>
          {health === null
            ? 'API недоступний. Перевірте, що запущено pnpm dev і Docker Compose.'
            : `API відповідає. База даних: ${health.database === 'up' ? 'підключена' : 'недоступна'}.`}
        </p>
      </section>
    </main>
  );
}

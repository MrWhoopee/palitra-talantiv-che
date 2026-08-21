import type { Metadata } from 'next';
import { adminApi } from '@/lib/admin-api';
import { readAccessToken } from '@/lib/session';
import { TestimonialForm } from './testimonial-form';

export const metadata: Metadata = {
  title: 'Відгуки — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminTestimonialsPage() {
  const accessToken = (await readAccessToken()) ?? '';
  const testimonials = await adminApi.getTestimonials(accessToken).catch(() => null);

  return (
    <>
      <header className="admin-head">
        <p className="admin-eyebrow">Сайт</p>
        <h1 className="admin-title">Відгуки</h1>
        <p className="admin-lede">
          Те, що про студію сказали батьки й учні. Новий відгук за замовчуванням не на сайті —
          спершу перечитайте його й пересвідчіться, що людина дозволила підписати себе саме так.
        </p>
      </header>

      {testimonials === null ? (
        <p className="admin-note">Не вдалося прочитати відгуки. Оновіть сторінку.</p>
      ) : (
        <>
          {testimonials.map((testimonial) => (
            <section className="admin-panel" key={testimonial.id}>
              <h2 className="admin-panel__title">
                {testimonial.authorName}
                {testimonial.isPublished ? null : (
                  <span className="admin-badge" data-tone="draft">
                    не на сайті
                  </span>
                )}
              </h2>
              <TestimonialForm value={testimonial} />
            </section>
          ))}

          {testimonials.length === 0 ? (
            <p className="admin-empty">Відгуків ще немає. Перший — у формі нижче.</p>
          ) : null}
        </>
      )}

      <section className="admin-panel">
        <h2 className="admin-panel__title">Новий відгук</h2>
        <TestimonialForm />
      </section>
    </>
  );
}

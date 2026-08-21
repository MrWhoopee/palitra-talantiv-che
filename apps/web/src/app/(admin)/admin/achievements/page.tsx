import type { Metadata } from 'next';
import { adminApi } from '@/lib/admin-api';
import { readAccessToken } from '@/lib/session';
import { AchievementForm } from './achievement-form';

export const metadata: Metadata = {
  title: 'Досягнення — Палітра талантів',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminAchievementsPage() {
  const accessToken = (await readAccessToken()) ?? '';
  const achievements = await adminApi.getAchievements(accessToken).catch(() => null);

  return (
    <>
      <header className="admin-head">
        <p className="admin-eyebrow">Сайт</p>
        <h1 className="admin-title">Досягнення</h1>
        <p className="admin-lede">
          Перемоги, конкурси, поїздки. На сайті вони йдуть від новіших років до старіших, а
          всередині року — так, як ви їх тут розставите.
        </p>
      </header>

      {achievements === null ? (
        <p className="admin-note">Не вдалося прочитати перелік. Оновіть сторінку.</p>
      ) : (
        <>
          {achievements.map((achievement) => (
            <section className="admin-panel" key={achievement.id}>
              <h2 className="admin-panel__title">
                {achievement.year} — {achievement.title}
                {achievement.isPublished ? null : (
                  <span className="admin-badge" data-tone="draft">
                    не на сайті
                  </span>
                )}
              </h2>
              <AchievementForm value={achievement} />
            </section>
          ))}

          {achievements.length === 0 ? (
            <p className="admin-empty">Ще нічого не записано. Перше — у формі нижче.</p>
          ) : null}
        </>
      )}

      <section className="admin-panel">
        <h2 className="admin-panel__title">Нове досягнення</h2>
        <AchievementForm />
      </section>
    </>
  );
}

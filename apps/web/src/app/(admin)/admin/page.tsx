import { SITE_TEXT_KEYS, type AdminTeacher, type SiteText } from '@palitra/shared';
import type { Metadata } from 'next';
import { adminApi } from '@/lib/admin-api';
import { readAccessToken } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Адмінка — Палітра талантів',
  robots: { index: false, follow: false },
};

/** The page names in the studio's own words; the keys are the code's. */
const PAGE_NAMES: Record<(typeof SITE_TEXT_KEYS)[number], string> = {
  home: 'Головна',
  about: 'Про нас',
  rules: 'Правила',
  contacts: 'Контакти',
};

/**
 * What the studio sees on opening the cabinet.
 *
 * Not a wall of counters. Two questions it can actually do something about -
 * is anyone waiting on an invitation, and which pages still read the way we
 * wrote them rather than the way the studio would - and nothing else. The rest
 * of the numbers belong on the screens that own them.
 */
export default async function AdminHomePage() {
  const accessToken = await readAccessToken();
  const state = accessToken ? await loadState(accessToken) : null;

  return (
    <>
      <header className="admin-head">
        <p className="admin-eyebrow">Палітра талантів</p>
        <h1 className="admin-title">Адмінка</h1>
        <p className="admin-lede">
          Звідси редагується все, що видно на сайті, і все, з чого складається робота студії.
          Розділи — ліворуч.
        </p>
      </header>

      {state === null ? (
        <p className="admin-note">
          Не вдалося прочитати дані студії. Оновіть сторінку — якщо не допоможе, API не відповідає.
        </p>
      ) : (
        <div className="admin-cards">
          <TeachersCard teachers={state.teachers} />
          <PagesCard texts={state.texts} />
        </div>
      )}
    </>
  );
}

async function loadState(
  accessToken: string,
): Promise<{ teachers: AdminTeacher[]; texts: SiteText[] } | null> {
  try {
    const [teachers, texts] = await Promise.all([
      adminApi.getTeachers(accessToken),
      adminApi.getSiteTexts(accessToken),
    ]);
    return { teachers, texts };
  } catch {
    // The cabinet is still usable with the sidebar alone, so a failed read
    // says so and gets out of the way rather than taking the screen down.
    return null;
  }
}

function TeachersCard({ teachers }: { teachers: AdminTeacher[] }) {
  const waiting = teachers.filter((teacher) => !teacher.hasPassword).length;
  const hidden = teachers.filter((teacher) => !teacher.isPublished).length;

  return (
    <section className="admin-card" data-tone="studio">
      <p className="admin-card__eyebrow">Студія</p>
      <p className="admin-card__figure">{teachers.length}</p>
      <h2 className="admin-card__label">викладачів у списку</h2>

      {teachers.length === 0 ? (
        <p className="admin-card__note">Ще нікого не запрошено.</p>
      ) : (
        <ul className="admin-card__lines">
          <li>
            {waiting === 0
              ? 'Запрошення прийняли всі.'
              : `Ще не прийняли запрошення: ${waiting}. Їм можна надіслати лист повторно.`}
          </li>
          <li>
            {hidden === 0
              ? 'Усі показані на сайті.'
              : `Не показані на сайті: ${hidden}. Зазвичай це ті, хто ще не надіслав фото.`}
          </li>
        </ul>
      )}
    </section>
  );
}

function PagesCard({ texts }: { texts: SiteText[] }) {
  const written = new Set(texts.map((text) => text.key));
  const untouched = SITE_TEXT_KEYS.filter((key) => !written.has(key));

  return (
    <section className="admin-card" data-tone="site">
      <p className="admin-card__eyebrow">Сайт</p>
      <p className="admin-card__figure">
        {written.size}
        <span className="admin-card__of">із {SITE_TEXT_KEYS.length}</span>
      </p>
      <h2 className="admin-card__label">сторінок написано студією</h2>

      <p className="admin-card__note">
        {untouched.length === 0
          ? 'Усі сторінки написані вами.'
          : `Показують текст із коду: ${untouched.map((key) => PAGE_NAMES[key]).join(', ')}.`}
      </p>
    </section>
  );
}

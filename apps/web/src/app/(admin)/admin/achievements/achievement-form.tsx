'use client';

import { STUDIO_FOUNDED, type AdminAchievement } from '@palitra/shared';
import { useActionState } from 'react';
import { deleteAchievementAction, saveAchievementAction } from '@/app/actions/admin-content';
import { DeleteRowForm } from '@/components/delete-row-form';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';

/**
 * A win or a trip, remembered by year rather than by date - which is the
 * precision such things are listed in, and the reason the box asks for four
 * digits instead of a calendar.
 */
export function AchievementForm({ value }: { value?: AdminAchievement }) {
  const [state, action] = useActionState(saveAchievementAction, emptyFormState);
  const submitted = state.values;
  const at = (name: string) => `${name}-${value?.id ?? 'new'}`;
  const latestYear = new Date().getFullYear() + 1;

  return (
    <>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done ? <FormAlert tone="ok">Збережено.</FormAlert> : null}

      <form className="admin-form" action={action} noValidate>
        {value ? <input type="hidden" name="id" value={value.id} /> : null}
        <input type="hidden" name="imageUrl" value={value?.imageUrl ?? ''} />

        <div className="admin-form__row">
          <Field
            label="Що саме"
            name="title"
            id={at('title')}
            required
            hint="Наприклад: перше місце на обласному конкурсі"
            defaultValue={submitted?.['title'] ?? value?.title ?? ''}
            errors={state.fieldErrors?.['title']}
          />
          <Field
            label="Рік"
            name="year"
            id={at('year')}
            type="number"
            min={STUDIO_FOUNDED}
            max={latestYear}
            required
            defaultValue={submitted?.['year'] ?? value?.year ?? latestYear - 1}
            errors={state.fieldErrors?.['year']}
          />
        </div>

        <p className="field">
          <label className="field-label" htmlFor={at('description')}>
            Подробиці
          </label>
          <textarea
            id={at('description')}
            name="description"
            className="field-input admin-textarea"
            rows={4}
            defaultValue={submitted?.['description'] ?? value?.description ?? ''}
          />
          <span className="field-hint">Можна не заповнювати.</span>
        </p>

        <div className="admin-photo">
          {value?.imageUrl ? (
            // A plain <img>: our own upload, at a size we chose.
            <img className="admin-photo__shot" src={value.imageUrl} alt="" />
          ) : (
            <p className="admin-photo__none">Фото немає</p>
          )}

          <div className="admin-photo__controls">
            <p className="field">
              <label className="field-label" htmlFor={at('image')}>
                {value?.imageUrl ? 'Нове фото' : 'Фото'}
              </label>
              <input
                id={at('image')}
                name="image"
                type="file"
                accept="image/*"
                className="field-input"
              />
              <span className="field-hint">Диплом, кубок, спільне фото. До 8 МБ.</span>
            </p>

            {value?.imageUrl ? (
              <label className="admin-check">
                <input type="checkbox" name="removeImage" />
                Прибрати нинішнє фото
              </label>
            ) : null}
          </div>
        </div>

        <div className="admin-form__row">
          <Field
            label="Порядок у межах року"
            name="sortOrder"
            id={at('sortOrder')}
            type="number"
            min={0}
            max={1000}
            hint="Роки самі йдуть від новіших до старіших"
            defaultValue={submitted?.['sortOrder'] ?? value?.sortOrder ?? 0}
            errors={state.fieldErrors?.['sortOrder']}
          />
        </div>

        <label className="admin-check">
          <input type="checkbox" name="isPublished" defaultChecked={value?.isPublished ?? false} />
          На сайті
        </label>

        <div className="admin-row__actions">
          <SubmitButton
            className={value ? 'admin-button admin-button--quiet' : 'admin-button'}
            pendingLabel="Зберігаємо…"
          >
            {value ? 'Зберегти' : 'Додати досягнення'}
          </SubmitButton>
        </div>
      </form>

      {value ? <DeleteRowForm action={deleteAchievementAction} id={value.id} /> : null}
    </>
  );
}

'use client';

import type { AdminDirection } from '@palitra/shared';
import { useActionState } from 'react';
import { deleteDirectionAction, saveDirectionAction } from '@/app/actions/admin-reference';
import { DeleteRowForm } from '@/components/delete-row-form';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';

export function DirectionForm({ value }: { value?: AdminDirection }) {
  const [state, action] = useActionState(saveDirectionAction, emptyFormState);
  const submitted = state.values;
  const at = (name: string) => `${name}-${value?.id ?? 'new'}`;

  return (
    <>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done ? <FormAlert tone="ok">Збережено.</FormAlert> : null}

      <form className="admin-form" action={action} noValidate>
        {value ? <input type="hidden" name="id" value={value.id} /> : null}

        <div className="admin-form__row">
          <Field
            label="Назва"
            name="name"
            id={at('name')}
            required
            defaultValue={submitted?.['name'] ?? value?.name ?? ''}
            errors={state.fieldErrors?.['name']}
          />
          <Field
            label="Адреса сторінки"
            name="slug"
            id={at('slug')}
            required
            hint="Латиницею: vokal, fortepiano. Це видно у посиланні."
            defaultValue={submitted?.['slug'] ?? value?.slug ?? ''}
            errors={state.fieldErrors?.['slug']}
          />
        </div>

        <p className="field">
          <label className="field-label" htmlFor={at('description')}>
            Опис
          </label>
          <textarea
            id={at('description')}
            name="description"
            className="field-input"
            rows={3}
            defaultValue={submitted?.['description'] ?? value?.description ?? ''}
          />
          <span className="field-hint">Кілька речень для сторінки напряму. Можна не заповнювати.</span>
        </p>

        <div className="admin-form__row">
          <Field
            label="Іконка"
            name="icon"
            id={at('icon')}
            hint="Назва іконки в коді сайту. Можна не заповнювати."
            defaultValue={submitted?.['icon'] ?? value?.icon ?? ''}
            errors={state.fieldErrors?.['icon']}
          />
          <Field
            label="Порядок"
            name="sortOrder"
            id={at('sortOrder')}
            type="number"
            min={0}
            max={1000}
            defaultValue={submitted?.['sortOrder'] ?? value?.sortOrder ?? 0}
            errors={state.fieldErrors?.['sortOrder']}
          />
        </div>

        <div className="admin-row__actions">
          <SubmitButton
            className={value ? 'admin-button admin-button--quiet' : 'admin-button'}
            pendingLabel="Зберігаємо…"
          >
            {value ? 'Зберегти' : 'Додати напрям'}
          </SubmitButton>
        </div>
      </form>

      {value ? <DeleteRowForm action={deleteDirectionAction} id={value.id} /> : null}
    </>
  );
}

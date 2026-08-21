'use client';

import type { AdminLocation } from '@palitra/shared';
import { useActionState } from 'react';
import { deleteLocationAction, saveLocationAction } from '@/app/actions/admin-reference';
import { DeleteRowForm } from '@/components/delete-row-form';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';

/**
 * One form for both jobs. A row being edited carries its id in a hidden field
 * and the empty one at the bottom does not - which is the whole difference
 * between changing an address and adding one.
 */
export function LocationForm({ value }: { value?: AdminLocation }) {
  const [state, action] = useActionState(saveLocationAction, emptyFormState);
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
            hint="Коротка, як її називають у студії: «Благовісна»"
            required
            defaultValue={submitted?.['name'] ?? value?.name ?? ''}
            errors={state.fieldErrors?.['name']}
          />
          <Field
            label="Адреса"
            name="address"
            id={at('address')}
            required
            defaultValue={submitted?.['address'] ?? value?.address ?? ''}
            errors={state.fieldErrors?.['address']}
          />
        </div>

        <div className="admin-form__row">
          <Field
            label="Посилання на мапу"
            name="mapUrl"
            id={at('mapUrl')}
            type="url"
            hint="Можна не заповнювати"
            defaultValue={submitted?.['mapUrl'] ?? value?.mapUrl ?? ''}
            errors={state.fieldErrors?.['mapUrl']}
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
            {value ? 'Зберегти' : 'Додати локацію'}
          </SubmitButton>
        </div>
      </form>

      {value ? <DeleteRowForm action={deleteLocationAction} id={value.id} /> : null}
    </>
  );
}

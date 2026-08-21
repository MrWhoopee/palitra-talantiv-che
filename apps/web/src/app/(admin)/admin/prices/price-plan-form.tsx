'use client';

import { LESSON_FORMATS, type AdminDirection, type AdminPricePlan } from '@palitra/shared';
import { useActionState } from 'react';
import { deletePricePlanAction, savePricePlanAction } from '@/app/actions/admin-reference';
import { DeleteRowForm } from '@/components/delete-row-form';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';

const FORMAT_LABELS: Record<(typeof LESSON_FORMATS)[number], string> = {
  INDIVIDUAL: 'Індивідуально',
  GROUP: 'У групі',
};

export function PricePlanForm({
  value,
  directions,
}: {
  value?: AdminPricePlan;
  directions: AdminDirection[];
}) {
  const [state, action] = useActionState(savePricePlanAction, emptyFormState);
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
            label="Назва тарифу"
            name="name"
            id={at('name')}
            required
            hint="Як він звучить у розмові: «Абонемент 8 занять»"
            defaultValue={submitted?.['name'] ?? value?.name ?? ''}
            errors={state.fieldErrors?.['name']}
          />

          <p className="field">
            <label className="field-label" htmlFor={at('directionId')}>
              Напрям
            </label>
            <select
              id={at('directionId')}
              name="directionId"
              className="field-input"
              defaultValue={submitted?.['directionId'] ?? value?.directionId ?? ''}
              required
            >
              {directions.map((direction) => (
                <option value={direction.id} key={direction.id}>
                  {direction.name}
                </option>
              ))}
            </select>
          </p>
        </div>

        <div className="admin-form__row">
          <Field
            label="Занять у тарифі"
            name="lessonsCount"
            id={at('lessonsCount')}
            type="number"
            min={1}
            max={100}
            required
            hint="Разове заняття — 1"
            defaultValue={submitted?.['lessonsCount'] ?? value?.lessonsCount ?? 1}
            errors={state.fieldErrors?.['lessonsCount']}
          />
          <Field
            label="Тривалість заняття, хв"
            name="durationMinutes"
            id={at('durationMinutes')}
            type="number"
            min={15}
            max={240}
            required
            hint="Записатися можна на 30, 45 або 60"
            defaultValue={submitted?.['durationMinutes'] ?? value?.durationMinutes ?? 45}
            errors={state.fieldErrors?.['durationMinutes']}
          />
        </div>

        <div className="admin-form__row">
          <p className="field">
            <label className="field-label" htmlFor={at('format')}>
              Формат
            </label>
            <select
              id={at('format')}
              name="format"
              className="field-input"
              defaultValue={submitted?.['format'] ?? value?.format ?? 'INDIVIDUAL'}
            >
              {LESSON_FORMATS.map((format) => (
                <option value={format} key={format}>
                  {FORMAT_LABELS[format]}
                </option>
              ))}
            </select>
          </p>

          <Field
            label="Ціна, ₴"
            name="priceUah"
            id={at('priceUah')}
            type="number"
            min={0}
            max={1000000}
            required
            defaultValue={submitted?.['priceUah'] ?? value?.priceUah ?? 0}
            errors={state.fieldErrors?.['priceUah']}
          />
        </div>

        <div className="admin-form__row">
          <label className="admin-check">
            <input type="checkbox" name="isActive" defaultChecked={value?.isActive ?? true} />
            Продається зараз
            <span className="admin-check__hint">
              Знято — тариф зникає з сайту, а вже продані за ним абонементи діють далі.
            </span>
          </label>

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
            {value ? 'Зберегти' : 'Додати тариф'}
          </SubmitButton>
        </div>
      </form>

      {value ? <DeleteRowForm action={deletePricePlanAction} id={value.id} /> : null}
    </>
  );
}

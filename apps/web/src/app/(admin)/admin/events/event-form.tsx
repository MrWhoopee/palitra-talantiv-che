'use client';

import { studioEventKindSchema, type AdminLocation, type AdminStudioEvent } from '@palitra/shared';
import { useActionState } from 'react';
import { deleteEventAction, saveEventAction } from '@/app/actions/admin-content';
import { DeleteRowForm } from '@/components/delete-row-form';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { EVENT_KIND_LABELS } from '@/lib/events';
import { emptyFormState } from '@/lib/form-state';
import { toDateTimeInput } from '@/lib/studio-time';

const KINDS = studioEventKindSchema.options;

/**
 * One event, whether it is being announced or corrected.
 *
 * The two moments are `datetime-local` boxes, which carry no zone of their
 * own: what is typed is Kyiv's wall clock, and the action converts it to an
 * instant on the way out and back on the way in. A concert at 18:00 has to
 * read as 18:00 to an admin whose laptop is set to another zone.
 */
export function EventForm({
  locations,
  value,
}: {
  locations: AdminLocation[];
  value?: AdminStudioEvent;
}) {
  const [state, action] = useActionState(saveEventAction, emptyFormState);
  const submitted = state.values;
  const at = (name: string) => `${name}-${value?.id ?? 'new'}`;

  return (
    <>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done ? <FormAlert tone="ok">Збережено.</FormAlert> : null}

      <form className="admin-form" action={action} noValidate>
        {value ? <input type="hidden" name="id" value={value.id} /> : null}
        {/* Carried through so a save that changes nothing else keeps the
            picture: the file box is empty on every render. */}
        <input type="hidden" name="coverUrl" value={value?.coverUrl ?? ''} />

        <div className="admin-form__row">
          <Field
            label="Назва"
            name="title"
            id={at('title')}
            required
            defaultValue={submitted?.['title'] ?? value?.title ?? ''}
            errors={state.fieldErrors?.['title']}
          />
          <Field
            label="Адреса сторінки"
            name="slug"
            id={at('slug')}
            required
            hint="Латиницею: zvitnyi-kontsert-2026"
            defaultValue={submitted?.['slug'] ?? value?.slug ?? ''}
            errors={state.fieldErrors?.['slug']}
          />
        </div>

        <div className="admin-form__row">
          <Field
            label="Початок"
            name="startsAt"
            id={at('startsAt')}
            type="datetime-local"
            required
            defaultValue={
              submitted?.['startsAt'] ?? (value ? toDateTimeInput(value.startsAt) : '')
            }
            errors={state.fieldErrors?.['startsAt']}
          />
          <Field
            label="Кінець"
            name="endsAt"
            id={at('endsAt')}
            type="datetime-local"
            hint="Можна не заповнювати"
            defaultValue={
              submitted?.['endsAt'] ?? (value?.endsAt ? toDateTimeInput(value.endsAt) : '')
            }
            errors={state.fieldErrors?.['endsAt']}
          />
        </div>

        <div className="admin-form__row">
          <p className="field">
            <label className="field-label" htmlFor={at('kind')}>
              Що це
            </label>
            <select
              id={at('kind')}
              name="kind"
              className="field-input"
              defaultValue={submitted?.['kind'] ?? value?.kind ?? 'CONCERT'}
            >
              {KINDS.map((kind) => (
                <option value={kind} key={kind}>
                  {EVENT_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </p>

          <p className="field">
            <label className="field-label" htmlFor={at('locationId')}>
              Де
            </label>
            <select
              id={at('locationId')}
              name="locationId"
              className="field-input"
              defaultValue={submitted?.['locationId'] ?? value?.locationId ?? ''}
            >
              <option value="">Не вказано</option>
              {locations.map((location) => (
                <option value={location.id} key={location.id}>
                  {location.name} — {location.address}
                </option>
              ))}
            </select>
          </p>
        </div>

        <p className="field">
          <label className="field-label" htmlFor={at('description')}>
            Опис
          </label>
          <textarea
            id={at('description')}
            name="description"
            className="field-input admin-textarea"
            rows={5}
            defaultValue={submitted?.['description'] ?? value?.description ?? ''}
          />
          <span className="field-hint">Кілька речень для афіші. Можна не заповнювати.</span>
        </p>

        <div className="admin-photo">
          {value?.coverUrl ? (
            // A plain <img>: the address comes from our own uploads and the
            // stored size is known, so there is nothing for next/image to
            // decide here.
            <img className="admin-photo__shot" src={value.coverUrl} alt="" />
          ) : (
            <p className="admin-photo__none">Обкладинки немає</p>
          )}

          <div className="admin-photo__controls">
            <p className="field">
              <label className="field-label" htmlFor={at('cover')}>
                {value?.coverUrl ? 'Нова обкладинка' : 'Обкладинка'}
              </label>
              <input
                id={at('cover')}
                name="cover"
                type="file"
                accept="image/*"
                className="field-input"
              />
              <span className="field-hint">Фото з телефона годиться — зменшимо самі. До 8 МБ.</span>
            </p>

            {value?.coverUrl ? (
              <label className="admin-check">
                <input type="checkbox" name="removeCover" />
                Прибрати нинішню обкладинку
              </label>
            ) : null}
          </div>
        </div>

        <label className="admin-check">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={value?.isPublished ?? false}
          />
          На сайті
          <span className="admin-check__hint">
            Знято — подія лишається тут як чернетка, в афіші її немає.
          </span>
        </label>

        <div className="admin-row__actions">
          <SubmitButton
            className={value ? 'admin-button admin-button--quiet' : 'admin-button'}
            pendingLabel="Зберігаємо…"
          >
            {value ? 'Зберегти' : 'Додати подію'}
          </SubmitButton>
        </div>
      </form>

      {value ? <DeleteRowForm action={deleteEventAction} id={value.id} /> : null}
    </>
  );
}

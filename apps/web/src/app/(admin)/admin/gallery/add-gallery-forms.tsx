'use client';

import type { AdminStudioEvent } from '@palitra/shared';
import { useActionState } from 'react';
import { addGalleryPhotoAction, saveGalleryItemAction } from '@/app/actions/admin-content';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';

/**
 * Two ways in, because they are two different things.
 *
 * A photo is a file that has to be stored before there is anything to point
 * at; a video is a link that already exists somewhere else. One form with a
 * switch would have to explain which half of itself is currently in use, and
 * the studio adds far more of the first kind than the second.
 */

export function AddPhotoForm({ events }: { events: AdminStudioEvent[] }) {
  const [state, action] = useActionState(addGalleryPhotoAction, emptyFormState);
  const submitted = state.values;

  return (
    <>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done ? <FormAlert tone="ok">Фото додано.</FormAlert> : null}

      <form className="admin-form" action={action} noValidate>
        <p className="field">
          <label className="field-label" htmlFor="photo">
            Файл
          </label>
          <input id="photo" name="photo" type="file" accept="image/*" className="field-input" />
          <span className="field-hint">
            Просто з телефона — ми зменшимо, зріжемо зайве й зробимо мініатюру. До 8 МБ.
          </span>
          {state.fieldErrors?.['photo']?.[0] ? (
            <span className="field-error">{state.fieldErrors['photo'][0]}</span>
          ) : null}
        </p>

        <div className="admin-form__row">
          <Field
            label="Підпис"
            name="caption"
            hint="Можна не заповнювати"
            defaultValue={submitted?.['caption'] ?? ''}
            errors={state.fieldErrors?.['caption']}
          />
          <EventPicker events={events} defaultValue={submitted?.['eventId'] ?? ''} id="eventId" />
        </div>

        <label className="admin-check">
          {/* Unlike a review, a photo was uploaded to be shown. */}
          <input type="checkbox" name="isPublished" defaultChecked />
          Одразу на сайт
        </label>

        <div className="admin-row__actions">
          <SubmitButton className="admin-button" pendingLabel="Завантажуємо…">
            Додати фото
          </SubmitButton>
        </div>
      </form>
    </>
  );
}

export function AddVideoForm({ events }: { events: AdminStudioEvent[] }) {
  const [state, action] = useActionState(saveGalleryItemAction, emptyFormState);
  const submitted = state.values;

  return (
    <>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done ? <FormAlert tone="ok">Відео додано.</FormAlert> : null}

      <form className="admin-form" action={action} noValidate>
        <input type="hidden" name="kind" value="VIDEO" />

        <Field
          label="Посилання на YouTube"
          name="url"
          id="video-url"
          type="url"
          required
          hint="Будь-яке з трьох: youtu.be/…, watch?v=… або вже готове embed"
          defaultValue={submitted?.['url'] ?? ''}
          errors={state.fieldErrors?.['url']}
        />

        <div className="admin-form__row">
          <Field
            label="Підпис"
            name="caption"
            id="video-caption"
            hint="Можна не заповнювати"
            defaultValue={submitted?.['caption'] ?? ''}
            errors={state.fieldErrors?.['caption']}
          />
          <EventPicker
            events={events}
            defaultValue={submitted?.['eventId'] ?? ''}
            id="video-eventId"
          />
        </div>

        <label className="admin-check">
          <input type="checkbox" name="isPublished" defaultChecked />
          Одразу на сайт
        </label>

        <div className="admin-row__actions">
          <SubmitButton className="admin-button" pendingLabel="Додаємо…">
            Додати відео
          </SubmitButton>
        </div>
      </form>
    </>
  );
}

function EventPicker({
  events,
  defaultValue,
  id,
}: {
  events: AdminStudioEvent[];
  defaultValue: string;
  id: string;
}) {
  return (
    <p className="field">
      <label className="field-label" htmlFor={id}>
        З якої події
      </label>
      <select id={id} name="eventId" className="field-input" defaultValue={defaultValue}>
        <option value="">Без події</option>
        {events.map((event) => (
          <option value={event.id} key={event.id}>
            {event.title}
          </option>
        ))}
      </select>
    </p>
  );
}

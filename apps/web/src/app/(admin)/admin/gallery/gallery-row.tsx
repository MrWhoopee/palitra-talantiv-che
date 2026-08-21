'use client';

import type { AdminGalleryItem, AdminStudioEvent } from '@palitra/shared';
import { useActionState } from 'react';
import {
  deleteGalleryItemAction,
  moveGalleryItemAction,
  saveGalleryItemAction,
} from '@/app/actions/admin-content';
import { DeleteRowForm } from '@/components/delete-row-form';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';

/**
 * One item in the gallery: its caption, which event it belongs to, and where
 * it sits in the running order.
 *
 * The picture itself is never re-uploaded here. Replacing a photo is deleting
 * one and adding another - the caption is not what makes it that photo, and a
 * "replace" that quietly orphans the old file on disk is the kind of thing
 * nobody notices until the disk is full.
 */
export function GalleryRow({
  item,
  events,
  order,
  isFirst,
  isLast,
}: {
  item: AdminGalleryItem;
  events: AdminStudioEvent[];
  /** The list as the screen is showing it, so a move is computed against that. */
  order: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [state, action] = useActionState(saveGalleryItemAction, emptyFormState);
  const [moveState, move] = useActionState(moveGalleryItemAction, emptyFormState);
  const submitted = state.values;
  const at = (name: string) => `${name}-${item.id}`;

  return (
    <section className="admin-panel">
      <div className="admin-media">
        {item.kind === 'PHOTO' ? (
          // A plain <img>: the address comes from our own uploads and the
          // stored size is known, so there is nothing for next/image to decide.
          <img className="admin-media__shot" src={item.thumbUrl ?? item.url} alt="" />
        ) : (
          <p className="admin-media__none">Відео</p>
        )}

        <div className="admin-media__body">
          <h2 className="admin-panel__title">{item.caption ?? 'Без підпису'}</h2>
          <p className="admin-row__meta">
            {item.kind === 'PHOTO' ? 'Фото' : 'Відео'} ·{' '}
            <a href={item.url} target="_blank" rel="noreferrer">
              відкрити оригінал
            </a>
          </p>

          <form className="admin-order" action={move}>
            <input type="hidden" name="ids" value={order} />
            <input type="hidden" name="id" value={item.id} />
            <button
              type="submit"
              name="direction"
              value="up"
              className="admin-link-button"
              disabled={isFirst}
              aria-label="Перемістити вище"
            >
              ↑
            </button>
            <button
              type="submit"
              name="direction"
              value="down"
              className="admin-link-button"
              disabled={isLast}
              aria-label="Перемістити нижче"
            >
              ↓
            </button>
          </form>

          {moveState.error ? <p className="admin-row__error">{moveState.error}</p> : null}
        </div>
      </div>

      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done ? <FormAlert tone="ok">Збережено.</FormAlert> : null}

      <form className="admin-form" action={action} noValidate>
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="kind" value={item.kind} />
        <input type="hidden" name="url" value={item.url} />
        <input type="hidden" name="thumbUrl" value={item.thumbUrl ?? ''} />

        <div className="admin-form__row">
          <Field
            label="Підпис"
            name="caption"
            id={at('caption')}
            hint="Можна не заповнювати"
            defaultValue={submitted?.['caption'] ?? item.caption ?? ''}
            errors={state.fieldErrors?.['caption']}
          />

          <p className="field">
            <label className="field-label" htmlFor={at('eventId')}>
              З якої події
            </label>
            <select
              id={at('eventId')}
              name="eventId"
              className="field-input"
              defaultValue={submitted?.['eventId'] ?? item.eventId ?? ''}
            >
              <option value="">Без події</option>
              {events.map((event) => (
                <option value={event.id} key={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </p>
        </div>

        <label className="admin-check">
          <input type="checkbox" name="isPublished" defaultChecked={item.isPublished} />
          На сайті
        </label>

        <div className="admin-row__actions">
          <SubmitButton className="admin-button admin-button--quiet" pendingLabel="Зберігаємо…">
            Зберегти
          </SubmitButton>
        </div>
      </form>

      <DeleteRowForm action={deleteGalleryItemAction} id={item.id} />
    </section>
  );
}

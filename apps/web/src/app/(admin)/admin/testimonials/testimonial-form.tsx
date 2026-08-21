'use client';

import type { AdminTestimonial } from '@palitra/shared';
import { useActionState } from 'react';
import { deleteTestimonialAction, saveTestimonialAction } from '@/app/actions/admin-content';
import { DeleteRowForm } from '@/components/delete-row-form';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';

/**
 * One form for both jobs. A review being edited carries its id in a hidden
 * field and the empty one at the bottom does not.
 *
 * Unpublished by default, which is the opposite of a gallery photo: a review
 * is typed in from a message someone sent, and the studio should read it back
 * once before it stands on the site under that person's name.
 */
export function TestimonialForm({ value }: { value?: AdminTestimonial }) {
  const [state, action] = useActionState(saveTestimonialAction, emptyFormState);
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
            label="Хто це сказав"
            name="authorName"
            id={at('authorName')}
            required
            hint="Так, як людина дозволила себе підписати"
            defaultValue={submitted?.['authorName'] ?? value?.authorName ?? ''}
            errors={state.fieldErrors?.['authorName']}
          />
          <Field
            label="Порядок"
            name="sortOrder"
            id={at('sortOrder')}
            type="number"
            min={0}
            max={1000}
            hint="Менше число — вище на сайті"
            defaultValue={submitted?.['sortOrder'] ?? value?.sortOrder ?? 0}
            errors={state.fieldErrors?.['sortOrder']}
          />
        </div>

        <p className="field">
          <label className="field-label" htmlFor={at('text')}>
            Відгук
          </label>
          <textarea
            id={at('text')}
            name="text"
            className="field-input admin-textarea"
            rows={5}
            required
            defaultValue={submitted?.['text'] ?? value?.text ?? ''}
            aria-invalid={Boolean(state.fieldErrors?.['text']?.length)}
          />
          {state.fieldErrors?.['text']?.[0] ? (
            <span className="field-error">{state.fieldErrors['text'][0]}</span>
          ) : null}
        </p>

        <label className="admin-check">
          <input type="checkbox" name="isPublished" defaultChecked={value?.isPublished ?? false} />
          На сайті
        </label>

        <div className="admin-row__actions">
          <SubmitButton
            className={value ? 'admin-button admin-button--quiet' : 'admin-button'}
            pendingLabel="Зберігаємо…"
          >
            {value ? 'Зберегти' : 'Додати відгук'}
          </SubmitButton>
        </div>
      </form>

      {value ? <DeleteRowForm action={deleteTestimonialAction} id={value.id} /> : null}
    </>
  );
}

'use client';

import type { SiteText, SiteTextKey } from '@palitra/shared';
import { useActionState } from 'react';
import { saveSiteTextAction } from '@/app/actions/admin-site';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';

/**
 * The wording of one page.
 *
 * There is no "add" and no "delete" here, unlike everywhere else in the
 * cabinet: the four pages exist because the app has routes for them. Saving
 * writes over the words; it never creates a page and never takes one away.
 */
export function SiteTextForm({ pageKey, value }: { pageKey: SiteTextKey; value?: SiteText }) {
  const [state, action] = useActionState(saveSiteTextAction, emptyFormState);
  const submitted = state.values;
  const at = (name: string) => `${name}-${pageKey}`;

  return (
    <>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done ? <FormAlert tone="ok">Збережено.</FormAlert> : null}

      <form className="admin-form" action={action} noValidate>
        <input type="hidden" name="key" value={pageKey} />

        <Field
          label="Заголовок"
          name="title"
          id={at('title')}
          required
          defaultValue={submitted?.['title'] ?? value?.title ?? ''}
          errors={state.fieldErrors?.['title']}
        />

        <p className="field">
          <label className="field-label" htmlFor={at('body')}>
            Текст
          </label>
          <textarea
            id={at('body')}
            name="body"
            className="field-input admin-textarea"
            rows={12}
            defaultValue={submitted?.['body'] ?? value?.body ?? ''}
            aria-invalid={Boolean(state.fieldErrors?.['body']?.length)}
          />
          <span className="field-hint">
            Порожній рядок починає новий абзац. Можна писати <code>## Підзаголовок</code>, списки
            через <code>-</code>, <code>**жирним**</code>, <code>*курсивом*</code> і посилання як{' '}
            <code>[текст](адреса)</code>.
          </span>
          {state.fieldErrors?.['body']?.[0] ? (
            <span className="field-error">{state.fieldErrors['body'][0]}</span>
          ) : null}
        </p>

        <div className="admin-row__actions">
          <SubmitButton className="admin-button" pendingLabel="Зберігаємо…">
            Зберегти
          </SubmitButton>
        </div>
      </form>
    </>
  );
}

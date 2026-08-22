'use client';

import { useActionState, useState } from 'react';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState, type FormState } from '@/lib/form-state';

/**
 * Deleting takes two presses.
 *
 * Not a browser `confirm()`: that dialog is a modal the page cannot style,
 * cannot translate, and cannot be tested through. The button turning into its
 * own question asks the same thing in the interface's own voice, and a first
 * press that was a mistake costs nothing.
 *
 * The failure is worth reading here rather than being swallowed - refusing to
 * delete an address the timetable is built on is the normal answer, not an
 * error, and the message says what to do instead.
 */
export function DeleteRowForm({
  action,
  id,
  label = 'Видалити',
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  id: string;
  label?: string;
}) {
  const [state, submit] = useActionState(action, emptyFormState);
  const [asked, setAsked] = useState(false);

  if (state.error) {
    return <p className="admin-row__error">{state.error}</p>;
  }

  if (!asked) {
    return (
      <button type="button" className="admin-link-button" onClick={() => setAsked(true)}>
        {label}
      </button>
    );
  }

  return (
    <form className="admin-confirm" action={submit}>
      <input type="hidden" name="id" value={id} />
      <span className="admin-confirm__question">Точно видалити?</span>
      <SubmitButton
        className="admin-link-button admin-link-button--danger"
        pendingLabel="Видаляємо…"
      >
        Так, видалити
      </SubmitButton>
      <button type="button" className="admin-link-button" onClick={() => setAsked(false)}>
        Скасувати
      </button>
    </form>
  );
}

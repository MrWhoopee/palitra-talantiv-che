'use client';

import { useActionState } from 'react';
import { reinviteTeacherAction } from '@/app/actions/admin-teachers';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';

/**
 * A form rather than a button with a handler: it changes something on the
 * server, so it must not be reachable by a prefetch, and it keeps working
 * without JavaScript.
 */
export function ReinviteForm({ teacherId }: { teacherId: string }) {
  const [state, action] = useActionState(reinviteTeacherAction, emptyFormState);

  return (
    <>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done ? (
        <FormAlert tone="ok">Новий лист надіслано. Попереднє посилання більше не працює.</FormAlert>
      ) : null}

      <form action={action}>
        <input type="hidden" name="teacherId" value={teacherId} />
        <SubmitButton className="admin-button admin-button--quiet" pendingLabel="Надсилаємо…">
          Надіслати запрошення ще раз
        </SubmitButton>
      </form>
    </>
  );
}

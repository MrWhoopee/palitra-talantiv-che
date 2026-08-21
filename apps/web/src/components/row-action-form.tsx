'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState, type FormState } from '@/lib/form-state';

/**
 * One button that does one thing to one row.
 *
 * Unlike `DeleteRowForm` it does not ask twice, because none of these is
 * destructive in the way deleting is: an application approved by mistake can
 * be removed again, and a package marked paid by mistake is a conversation,
 * not a lost row.
 *
 * The failure is shown rather than swallowed. A group with no places left
 * refuses an approval, and that is the right answer rather than a fault - so
 * the studio needs to read it where it pressed.
 */
export function RowActionForm({
  action,
  id,
  label,
  pendingLabel,
  tone = 'quiet',
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  id: string;
  label: string;
  pendingLabel: string;
  tone?: 'quiet' | 'danger' | 'primary';
}) {
  const [state, submit] = useActionState(action, emptyFormState);

  const className =
    tone === 'primary'
      ? 'admin-button'
      : tone === 'danger'
        ? 'admin-link-button admin-link-button--danger'
        : 'admin-link-button';

  return (
    <>
      <form action={submit}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton className={className} pendingLabel={pendingLabel}>
          {label}
        </SubmitButton>
      </form>

      {state.error ? <p className="admin-row__error">{state.error}</p> : null}
    </>
  );
}

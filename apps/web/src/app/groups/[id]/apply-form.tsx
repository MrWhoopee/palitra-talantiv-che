'use client';

import { useActionState } from 'react';
import { applyToGroupAction } from '@/app/actions/groups';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';

export function ApplyForm({ groupId, disabled }: { groupId: string; disabled: boolean }) {
  const [state, action] = useActionState(applyToGroupAction, emptyFormState);

  return (
    <form action={action}>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}

      <input type="hidden" name="groupId" value={groupId} />

      <p className="panel-hint">
        Місце тримається від моменту заявки, тож ніхто не займе його, поки викладач її розглядає.
      </p>

      {disabled ? (
        <p className="empty">Набір до цієї групи зараз закрито.</p>
      ) : (
        <SubmitButton className="button-primary" pendingLabel="Надсилаємо…">
          Подати заявку
        </SubmitButton>
      )}
    </form>
  );
}

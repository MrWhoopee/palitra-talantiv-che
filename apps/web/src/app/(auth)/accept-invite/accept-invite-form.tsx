'use client';

import { useActionState } from 'react';
import { acceptInviteAction } from '@/app/actions/auth';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInviteAction, emptyFormState);

  return (
    <>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}

      <form className="auth-form" action={action} noValidate>
        {/* The token belongs to the link, not to anything the person types. */}
        <input type="hidden" name="token" value={token} />

        <Field
          label="Пароль"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="Щонайменше 8 символів"
          required
          errors={state.fieldErrors?.['password']}
        />

        <SubmitButton pendingLabel="Заходимо…">Почати роботу</SubmitButton>
      </form>
    </>
  );
}

'use client';

import { useActionState } from 'react';
import { requestPasswordResetAction } from '@/app/actions/auth';
import { emptyFormState } from '@/lib/form-state';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, emptyFormState);
  const values = state.values ?? {};

  if (state.done) {
    // Shown whether or not the address belongs to an account: anything else
    // would let a stranger check who attends the studio.
    return (
      <FormAlert tone="ok">
        Якщо така пошта є в системі, лист із посиланням уже відправлено. Посилання дійсне годину.
      </FormAlert>
    );
  }

  return (
    <>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}

      <form className="auth-form" action={action} noValidate>
        <Field
          label="Електронна пошта"
          name="email"
          defaultValue={values['email'] ?? ''}
          type="email"
          autoComplete="email"
          required
          errors={state.fieldErrors?.['email']}
        />

        <SubmitButton pendingLabel="Надсилаємо…">Надіслати посилання</SubmitButton>
      </form>
    </>
  );
}

'use client';

import { useActionState } from 'react';
import { loginAction } from '@/app/actions/auth';
import { emptyFormState } from '@/lib/form-state';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';

export function LoginForm() {
  const [state, action] = useActionState(loginAction, emptyFormState);
  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};

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
          errors={errors['email']}
        />

        <Field
          label="Пароль"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          errors={errors['password']}
        />

        <SubmitButton pendingLabel="Входимо…">Увійти</SubmitButton>
      </form>
    </>
  );
}

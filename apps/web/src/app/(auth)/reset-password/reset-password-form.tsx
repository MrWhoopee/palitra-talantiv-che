'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { resetPasswordAction } from '@/app/actions/auth';
import { emptyFormState } from '@/lib/form-state';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, emptyFormState);

  if (state.done) {
    return (
      <>
        <FormAlert tone="ok">
          Пароль змінено. Усі попередні входи завершені — на інших пристроях доведеться увійти
          заново.
        </FormAlert>
        <p className="auth-footnote">
          <Link href="/login">Перейти до входу</Link>
        </p>
      </>
    );
  }

  return (
    <>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}

      <form className="auth-form" action={action} noValidate>
        {/* The token belongs to the link, not to anything the person types. */}
        <input type="hidden" name="token" value={token} />

        <Field
          label="Новий пароль"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="Щонайменше 8 символів"
          required
          errors={state.fieldErrors?.['password']}
        />

        <SubmitButton pendingLabel="Зберігаємо…">Зберегти пароль</SubmitButton>
      </form>
    </>
  );
}

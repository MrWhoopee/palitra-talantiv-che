'use client';

import { useActionState } from 'react';
import { registerAction } from '@/app/actions/auth';
import { emptyFormState } from '@/lib/form-state';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, emptyFormState);
  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};

  return (
    <>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}

      <form className="auth-form" action={action} noValidate>
        <div className="auth-row">
          <Field
            label="Ім'я"
            name="firstName"
            defaultValue={values['firstName'] ?? ''}
            autoComplete="given-name"
            required
            errors={errors['firstName']}
          />
          <Field
            label="Прізвище"
            name="lastName"
            defaultValue={values['lastName'] ?? ''}
            autoComplete="family-name"
            required
            errors={errors['lastName']}
          />
        </div>

        <Field
          label="Телефон"
          name="phone"
          defaultValue={values['phone'] ?? ''}
          type="tel"
          autoComplete="tel"
          placeholder="+380 67 123 45 67"
          required
          errors={errors['phone']}
        />

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
          autoComplete="new-password"
          hint="Щонайменше 8 символів"
          required
          errors={errors['password']}
        />

        <SubmitButton pendingLabel="Створюємо кабінет…">Створити кабінет</SubmitButton>
      </form>
    </>
  );
}

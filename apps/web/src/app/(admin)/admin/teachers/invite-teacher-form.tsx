'use client';

import { useActionState } from 'react';
import { inviteTeacherAction } from '@/app/actions/admin-teachers';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';

export function InviteTeacherForm() {
  const [state, action] = useActionState(inviteTeacherAction, emptyFormState);

  return (
    <>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done ? <FormAlert tone="ok">Запрошення надіслано.</FormAlert> : null}

      <form className="admin-form" action={action} noValidate>
        <div className="admin-form__row">
          <Field
            label="Ім'я"
            name="firstName"
            autoComplete="off"
            required
            defaultValue={state.values?.['firstName'] ?? ''}
            errors={state.fieldErrors?.['firstName']}
          />
          <Field
            label="Прізвище"
            name="lastName"
            autoComplete="off"
            required
            defaultValue={state.values?.['lastName'] ?? ''}
            errors={state.fieldErrors?.['lastName']}
          />
        </div>

        <div className="admin-form__row">
          <Field
            label="Електронна пошта"
            name="email"
            type="email"
            autoComplete="off"
            hint="На цю адресу піде запрошення"
            required
            defaultValue={state.values?.['email'] ?? ''}
            errors={state.fieldErrors?.['email']}
          />
          <Field
            label="Телефон"
            name="phone"
            type="tel"
            autoComplete="off"
            required
            defaultValue={state.values?.['phone'] ?? ''}
            errors={state.fieldErrors?.['phone']}
          />
        </div>

        <SubmitButton className="admin-button" pendingLabel="Надсилаємо…">
          Надіслати запрошення
        </SubmitButton>
      </form>
    </>
  );
}

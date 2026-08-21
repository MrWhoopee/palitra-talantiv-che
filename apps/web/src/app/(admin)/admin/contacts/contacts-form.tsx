'use client';

import type { SiteSettings } from '@palitra/shared';
import { useActionState } from 'react';
import { saveSiteSettingsAction } from '@/app/actions/admin-site';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';

/**
 * The footer's facts, in one form saved in one press.
 *
 * Every box is sent, empty ones included: clearing a box is how the studio
 * takes a line back out of the footer, and the site falls back to what it was
 * built with rather than showing a blank. That is the reason nothing here is
 * marked required - a studio with no Facebook page should be able to say so.
 */
export function ContactsForm({ settings }: { settings: SiteSettings }) {
  const [state, action] = useActionState(saveSiteSettingsAction, emptyFormState);
  const submitted = state.values;

  const box = (name: keyof SiteSettings) => ({
    name,
    defaultValue: submitted?.[name] ?? settings[name] ?? '',
    errors: state.fieldErrors?.[name],
  });

  return (
    <>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done ? <FormAlert tone="ok">Збережено.</FormAlert> : null}

      <form className="admin-form" action={action} noValidate>
        <div className="admin-form__row">
          <Field
            label="Телефон"
            type="tel"
            hint="Як його набирають: +380 67 123 45 67"
            {...box('phone')}
          />
          <Field label="Пошта" type="email" {...box('email')} />
        </div>

        <div className="admin-form__row">
          <Field
            label="Instagram"
            type="url"
            hint="Повне посилання, від https://"
            {...box('instagram')}
          />
          <Field label="Telegram" type="url" {...box('telegram')} />
        </div>

        <div className="admin-form__row">
          <Field label="Facebook" type="url" {...box('facebook')} />
          <Field
            label="Години роботи"
            hint="Одним рядком: «Пн–Пт 15:00–20:00, Сб 10:00–14:00»"
            {...box('workingHours')}
          />
        </div>

        <div className="admin-row__actions">
          <SubmitButton className="admin-button" pendingLabel="Зберігаємо…">
            Зберегти
          </SubmitButton>
        </div>
      </form>
    </>
  );
}

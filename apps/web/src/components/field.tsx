import type { ComponentPropsWithoutRef } from 'react';

interface FieldProps extends ComponentPropsWithoutRef<'input'> {
  label: string;
  name: string;
  hint?: string | undefined;
  errors?: string[] | undefined;
}

/**
 * The id follows the name unless it is given, which is what lets the same form
 * appear more than once on a page. Where a screen lists eight price plans, all
 * eight "Назва" fields would otherwise share one id and every label would
 * point at the first of them.
 */
export function Field({ label, name, id = name, hint, errors, ...input }: FieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const invalid = Boolean(errors?.length);

  return (
    <p className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        {...input}
        id={id}
        name={name}
        className="field-input"
        aria-invalid={invalid}
        // Pointing at the message rather than repeating it keeps a screen
        // reader from announcing the label twice on every keystroke.
        aria-describedby={invalid ? errorId : hint ? hintId : undefined}
      />
      {hint && !invalid ? (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {invalid ? (
        <span className="field-error" id={errorId}>
          {errors?.[0]}
        </span>
      ) : null}
    </p>
  );
}

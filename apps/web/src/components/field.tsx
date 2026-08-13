import type { ComponentPropsWithoutRef } from 'react';

interface FieldProps extends ComponentPropsWithoutRef<'input'> {
  label: string;
  name: string;
  hint?: string | undefined;
  errors?: string[] | undefined;
}

export function Field({ label, name, hint, errors, ...input }: FieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const invalid = Boolean(errors?.length);

  return (
    <p className="field">
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <input
        {...input}
        id={name}
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

'use client';

import { useActionState } from 'react';
import { setTeacherLinksAction } from '@/app/actions/admin-teachers';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';

export interface LinkOption {
  id: string;
  label: string;
}

/**
 * A set of checkboxes that is saved as a set. A box left unticked is simply
 * one the browser does not submit, which is exactly what "these are the
 * subjects now" means - so there is nothing to add or remove one at a time.
 */
export function LinksForm({
  teacherId,
  kind,
  options,
  checked,
}: {
  teacherId: string;
  kind: 'directions' | 'locations';
  options: LinkOption[];
  checked: string[];
}) {
  const [state, action] = useActionState(setTeacherLinksAction, emptyFormState);
  const chosen = new Set(checked);

  if (options.length === 0) {
    return (
      <p className="admin-empty">
        {kind === 'directions'
          ? 'Напрямів ще немає — спершу додайте їх у розділі «Напрями».'
          : 'Локацій ще немає — спершу додайте їх у розділі «Локації».'}
      </p>
    );
  }

  return (
    <>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done ? <FormAlert tone="ok">Збережено.</FormAlert> : null}

      <form className="admin-form" action={action}>
        <input type="hidden" name="teacherId" value={teacherId} />
        <input type="hidden" name="kind" value={kind} />

        <div className="admin-checks">
          {options.map((option) => (
            <label className="admin-check" key={option.id}>
              <input
                type="checkbox"
                name="ids"
                value={option.id}
                defaultChecked={chosen.has(option.id)}
              />
              {option.label}
            </label>
          ))}
        </div>

        <SubmitButton className="admin-button admin-button--quiet" pendingLabel="Зберігаємо…">
          Зберегти
        </SubmitButton>
      </form>
    </>
  );
}

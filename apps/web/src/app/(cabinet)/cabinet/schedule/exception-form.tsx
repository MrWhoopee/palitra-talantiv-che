'use client';

import { useActionState } from 'react';
import { createExceptionAction } from '@/app/actions/availability';
import { FormAlert } from '@/components/form-alert';
import { emptyFormState } from '@/lib/form-state';

export function ExceptionForm({ teacherId, today }: { teacherId: string; today: string }) {
  const [state, action] = useActionState(createExceptionAction, emptyFormState);

  return (
    <form className="schedule-form" action={action}>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done ? <FormAlert tone="ok">Відсутність збережено.</FormAlert> : null}

      <input type="hidden" name="teacherId" value={teacherId} />

      <div className="schedule-row">
        <p className="field">
          <label className="field-label" htmlFor="startsOn">
            Перший день
          </label>
          <input
            id="startsOn"
            name="startsOn"
            type="date"
            className="field-input"
            defaultValue={today}
            required
          />
        </p>
        <p className="field">
          <label className="field-label" htmlFor="endsOn">
            Останній день
          </label>
          {/* Both ends are inclusive: the last day is a day off in full, which
              is how a person means "з 10 по 20". */}
          <input
            id="endsOn"
            name="endsOn"
            type="date"
            className="field-input"
            defaultValue={today}
            required
          />
        </p>
      </div>

      <p className="field">
        <label className="field-label" htmlFor="kind">
          Причина
        </label>
        <select id="kind" name="kind" className="field-input" defaultValue="VACATION">
          <option value="VACATION">Відпустка</option>
          <option value="SICK">Хвороба</option>
          <option value="BLOCKED">Зайнято</option>
        </select>
      </p>

      <p className="field">
        <label className="field-label" htmlFor="note">
          Нотатка
        </label>
        <input id="note" name="note" className="field-input" maxLength={200} />
      </p>

      <button type="submit" className="button-primary">
        Додати відсутність
      </button>
    </form>
  );
}

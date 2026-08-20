'use client';

import type { AttendanceEntry, AttendanceStatus } from '@palitra/shared';
import { useActionState } from 'react';
import { saveAttendanceAction } from '@/app/actions/groups';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';

/**
 * "Не відмічено" is a real answer, not a missing one: a teacher who opens the
 * register before the lesson leaves it empty, and one who ticks a name by
 * mistake needs a way back to nothing.
 */
const MARKS: { value: AttendanceStatus | ''; label: string }[] = [
  { value: '', label: 'Не відмічено' },
  { value: 'PRESENT', label: 'Був' },
  { value: 'ABSENT', label: 'Не був' },
  { value: 'EXCUSED', label: 'Поважна причина' },
];

export function RegisterForm({
  lessonId,
  entries,
}: {
  lessonId: string;
  entries: readonly AttendanceEntry[];
}) {
  const [state, action] = useActionState(saveAttendanceAction, emptyFormState);

  return (
    <form action={action}>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done ? <FormAlert tone="ok">Журнал збережено.</FormAlert> : null}

      <input type="hidden" name="lessonId" value={lessonId} />

      <ul className="register">
        {entries.map((entry) => (
          <li key={entry.student.id} className="register-row">
            <span className="register-name">
              {entry.student.lastName} {entry.student.firstName}
            </span>

            <fieldset className="register-marks">
              <legend className="visually-hidden">
                {entry.student.lastName} {entry.student.firstName}
              </legend>

              {MARKS.map((mark) => (
                <label key={mark.label} className="register-mark">
                  <input
                    type="radio"
                    name={`mark-${entry.student.id}`}
                    value={mark.value}
                    defaultChecked={(entry.status ?? '') === mark.value}
                  />
                  <span>{mark.label}</span>
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ul>

      <SubmitButton pendingLabel="Зберігаємо…">Зберегти журнал</SubmitButton>
    </form>
  );
}

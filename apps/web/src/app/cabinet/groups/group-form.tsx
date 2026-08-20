'use client';

import { LESSON_DURATIONS, type Direction, type Location } from '@palitra/shared';
import { useActionState } from 'react';
import { createGroupAction } from '@/app/actions/groups';
import { FormAlert } from '@/components/form-alert';
import { emptyFormState } from '@/lib/form-state';
import { WEEKDAY_LABELS } from '@/lib/studio-time';

/**
 * Three meeting rows, filled in from the top. An "add another" button would
 * need JavaScript to mean anything, and the studio has no course that meets
 * more often than three times a week.
 */
const MEETING_ROWS = [0, 1, 2];

export function GroupForm({
  locations,
  directions,
  today,
}: {
  locations: readonly Location[];
  directions: readonly Direction[];
  today: string;
}) {
  const [state, action] = useActionState(createGroupAction, emptyFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form className="schedule-form" action={action}>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done && !state.error ? <FormAlert tone="ok">Групу створено.</FormAlert> : null}

      <p className="field">
        <label className="field-label" htmlFor="name">
          Назва
        </label>
        <input
          id="name"
          name="name"
          className="field-input"
          required
          maxLength={120}
          placeholder="Вокальний ансамбль"
          aria-invalid={Boolean(errors['name']?.length)}
        />
      </p>

      <div className="schedule-row">
        <p className="field">
          <label className="field-label" htmlFor="directionId">
            Напрям
          </label>
          <select id="directionId" name="directionId" className="field-input" required>
            {directions.map((direction) => (
              <option key={direction.id} value={direction.id}>
                {direction.name}
              </option>
            ))}
          </select>
        </p>

        <p className="field">
          <label className="field-label" htmlFor="locationId">
            Локація
          </label>
          <select id="locationId" name="locationId" className="field-input" required>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </p>
      </div>

      <div className="schedule-row">
        <p className="field">
          <label className="field-label" htmlFor="capacity">
            Місць
          </label>
          <input
            id="capacity"
            name="capacity"
            type="number"
            min={2}
            max={20}
            defaultValue={8}
            className="field-input"
            required
            aria-invalid={Boolean(errors['capacity']?.length)}
          />
        </p>

        <p className="field">
          <label className="field-label" htmlFor="durationMinutes">
            Тривалість
          </label>
          <select
            id="durationMinutes"
            name="durationMinutes"
            className="field-input"
            defaultValue={60}
          >
            {LESSON_DURATIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} хв
              </option>
            ))}
          </select>
        </p>
      </div>

      <div className="schedule-row">
        <p className="field">
          <label className="field-label" htmlFor="startsOn">
            Перше заняття
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
            Останнє заняття
          </label>
          <input
            id="endsOn"
            name="endsOn"
            type="date"
            className="field-input"
            aria-invalid={Boolean(errors['endsOn']?.length)}
          />
          <span className="field-hint">Порожньо — курс без кінця</span>
          {errors['endsOn']?.[0] ? <span className="field-error">{errors['endsOn'][0]}</span> : null}
        </p>
      </div>

      <fieldset className="schedule-fieldset">
        <legend className="field-label">Коли збирається</legend>
        {errors['schedule']?.[0] ? (
          <span className="field-error">{errors['schedule'][0]}</span>
        ) : null}

        {MEETING_ROWS.map((row) => (
          <div className="schedule-row" key={row}>
            <p className="field">
              <label className="field-label" htmlFor={`weekday-${row}`}>
                День {row + 1}
              </label>
              <select
                id={`weekday-${row}`}
                name={`weekday-${row}`}
                className="field-input"
                defaultValue={row === 0 ? 3 : 1}
              >
                {WEEKDAY_LABELS.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </p>

            <p className="field">
              <label className="field-label" htmlFor={`startTime-${row}`}>
                Початок
              </label>
              <input
                id={`startTime-${row}`}
                name={`startTime-${row}`}
                type="time"
                className="field-input"
                {...(row === 0 ? { defaultValue: '17:00', required: true } : {})}
              />
              {row > 0 ? <span className="field-hint">Порожньо — цього дня немає</span> : null}
            </p>
          </div>
        ))}
      </fieldset>

      <p className="field field-check">
        <input id="isOpenForEnrollment" name="isOpenForEnrollment" type="checkbox" defaultChecked />
        <label htmlFor="isOpenForEnrollment">Відкрити набір</label>
      </p>

      <button type="submit" className="button-primary">
        Створити групу
      </button>
    </form>
  );
}

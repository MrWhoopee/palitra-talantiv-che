'use client';

import type { Location } from '@palitra/shared';
import { useActionState } from 'react';
import { createRuleAction } from '@/app/actions/availability';
import { FormAlert } from '@/components/form-alert';
import { emptyFormState } from '@/lib/form-state';
import { WEEKDAY_LABELS } from '@/lib/studio-time';

export function RuleForm({
  teacherId,
  locations,
  today,
}: {
  teacherId: string;
  locations: readonly Location[];
  today: string;
}) {
  const [state, action] = useActionState(createRuleAction, emptyFormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form className="schedule-form" action={action}>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done ? <FormAlert tone="ok">Правило додано.</FormAlert> : null}

      <input type="hidden" name="teacherId" value={teacherId} />

      <p className="field">
        <label className="field-label" htmlFor="weekday">
          День тижня
        </label>
        <select id="weekday" name="weekday" className="field-input" defaultValue="1">
          {WEEKDAY_LABELS.map((label, index) => (
            <option key={label} value={index}>
              {label}
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

      <div className="schedule-row">
        <p className="field">
          <label className="field-label" htmlFor="startTime">
            З
          </label>
          <input
            id="startTime"
            name="startTime"
            type="time"
            className="field-input"
            defaultValue="10:00"
            required
            aria-invalid={Boolean(errors['startTime']?.length)}
          />
        </p>
        <p className="field">
          <label className="field-label" htmlFor="endTime">
            До
          </label>
          <input
            id="endTime"
            name="endTime"
            type="time"
            className="field-input"
            defaultValue="18:00"
            required
            aria-invalid={Boolean(errors['endTime']?.length)}
          />
          {errors['endTime']?.[0] ? (
            <span className="field-error">{errors['endTime'][0]}</span>
          ) : null}
        </p>
      </div>

      <div className="schedule-row">
        <p className="field">
          <label className="field-label" htmlFor="validFrom">
            Діє з
          </label>
          <input
            id="validFrom"
            name="validFrom"
            type="date"
            className="field-input"
            defaultValue={today}
            required
          />
        </p>
        <p className="field">
          <label className="field-label" htmlFor="validTo">
            Діє до
          </label>
          <input id="validTo" name="validTo" type="date" className="field-input" />
          <span className="field-hint">Порожньо — без обмеження</span>
        </p>
      </div>

      <button type="submit" className="button-primary">
        Додати правило
      </button>
    </form>
  );
}

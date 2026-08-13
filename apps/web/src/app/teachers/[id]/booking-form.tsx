'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { bookSlotAction } from '@/app/actions/booking';
import { FormAlert } from '@/components/form-alert';
import { emptyFormState } from '@/lib/form-state';

interface SlotView {
  /** `startsAt|locationId` - a submit button carries one value, a slot is two. */
  value: string;
  label: string;
  locationName: string;
}

interface DayView {
  key: string;
  label: string;
  slots: SlotView[];
}

interface BookingFormProps {
  teacherId: string;
  planId: string;
  signedIn: boolean;
  trialAvailable: boolean;
  days: DayView[];
  showLocations: boolean;
}

export function BookingForm({
  teacherId,
  planId,
  signedIn,
  trialAvailable,
  days,
  showLocations,
}: BookingFormProps) {
  const [state, action] = useActionState(bookSlotAction, emptyFormState);
  const empty = days.every((day) => day.slots.length === 0);

  return (
    <form action={action}>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}

      <input type="hidden" name="teacherId" value={teacherId} />
      <input type="hidden" name="pricePlanId" value={planId} />

      <fieldset className="kind-choice">
        <legend className="panel-hint">Тип заняття</legend>
        {trialAvailable ? (
          <label className="kind-option">
            <input type="radio" name="kind" value="TRIAL" defaultChecked />
            <span>
              Пробне <em>безкоштовно, один раз</em>
            </span>
          </label>
        ) : null}
        <label className="kind-option">
          <input type="radio" name="kind" value="SINGLE" defaultChecked={!trialAvailable} />
          <span>
            Разове <em>оплата в студії</em>
          </span>
        </label>
      </fieldset>

      {empty ? (
        <p className="empty">Цього тижня вільного часу немає. Подивіться наступний.</p>
      ) : (
        <ul className="day-list">
          {days
            .filter((day) => day.slots.length > 0)
            .map((day) => (
              <li key={day.key} className="day">
                <h3 className="day-title">{day.label}</h3>
                <div className="slot-row">
                  {day.slots.map((slot) => (
                    <SlotButton
                      key={slot.value}
                      slot={slot}
                      disabled={!signedIn}
                      showLocation={showLocations}
                    />
                  ))}
                </div>
              </li>
            ))}
        </ul>
      )}
    </form>
  );
}

function SlotButton({
  slot,
  disabled,
  showLocation,
}: {
  slot: SlotView;
  disabled: boolean;
  showLocation: boolean;
}) {
  // Every button in the form goes quiet while one of them is in flight: two
  // clicks on two different hours would otherwise book both.
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="slot"
      value={slot.value}
      className="slot"
      disabled={disabled || pending}
      title={disabled ? 'Увійдіть, щоб записатися' : undefined}
    >
      <span className="slot-time">{slot.label}</span>
      {showLocation && slot.locationName ? (
        <span className="slot-place">{slot.locationName}</span>
      ) : null}
    </button>
  );
}

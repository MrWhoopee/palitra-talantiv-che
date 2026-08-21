'use client';

import type { AdminLocation, AdminPricePlan, AdminStudent, AdminTeacher } from '@palitra/shared';
import { useActionState, useState } from 'react';
import { bookForStudentAction } from '@/app/actions/admin-operations';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';
import { formatUah } from '@/lib/studio';

/**
 * A lesson booked on someone's behalf - the one the studio takes over the
 * phone, for a parent who is not going to open a website to do it.
 *
 * The time is typed rather than picked off a list of free ones. The rule about
 * what is free lives in the API, and a picker here would be a second copy of
 * it that can disagree; the studio knows its teachers' hours, and a time that
 * will not do comes back said plainly. That is the same reasoning the
 * database's overlap constraint is there for: the last word belongs to the
 * side that cannot be raced.
 */
export function BookLessonForm({
  students,
  teachers,
  locations,
  plans,
}: {
  students: AdminStudent[];
  teachers: AdminTeacher[];
  locations: AdminLocation[];
  plans: AdminPricePlan[];
}) {
  const [state, action] = useActionState(bookForStudentAction, emptyFormState);
  const [kind, setKind] = useState('SINGLE');
  const submitted = state.values;

  return (
    <>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done ? <FormAlert tone="ok">Записано.</FormAlert> : null}

      <form className="admin-form" action={action} noValidate>
        <div className="admin-form__row">
          <p className="field">
            <label className="field-label" htmlFor="book-studentId">
              Учень
            </label>
            <select
              id="book-studentId"
              name="studentId"
              className="field-input"
              required
              defaultValue={submitted?.['studentId'] ?? ''}
            >
              <option value="">Оберіть учня</option>
              {students.map((student) => (
                <option value={student.id} key={student.id}>
                  {student.lastName} {student.firstName} · {student.phone}
                </option>
              ))}
            </select>
            {state.fieldErrors?.['studentId']?.[0] ? (
              <span className="field-error">{state.fieldErrors['studentId'][0]}</span>
            ) : null}
          </p>

          <p className="field">
            <label className="field-label" htmlFor="book-teacherId">
              Викладач
            </label>
            <select
              id="book-teacherId"
              name="teacherId"
              className="field-input"
              required
              defaultValue={submitted?.['teacherId'] ?? ''}
            >
              <option value="">Оберіть викладача</option>
              {teachers
                .filter((teacher) => teacher.isActive)
                .map((teacher) => (
                  <option value={teacher.id} key={teacher.id}>
                    {teacher.lastName} {teacher.firstName}
                  </option>
                ))}
            </select>
          </p>
        </div>

        <div className="admin-form__row">
          <p className="field">
            <label className="field-label" htmlFor="book-locationId">
              Локація
            </label>
            <select
              id="book-locationId"
              name="locationId"
              className="field-input"
              required
              defaultValue={submitted?.['locationId'] ?? ''}
            >
              <option value="">Оберіть локацію</option>
              {locations.map((location) => (
                <option value={location.id} key={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </p>

          <Field
            label="Коли"
            name="startsAt"
            id="book-startsAt"
            type="datetime-local"
            required
            hint="Час за Києвом, у робочі години викладача"
            defaultValue={submitted?.['startsAt'] ?? ''}
            errors={state.fieldErrors?.['startsAt']}
          />
        </div>

        <fieldset className="admin-switches">
          <legend className="field-label">За що</legend>

          {[
            ['SINGLE', 'Разове заняття'],
            ['TRIAL', 'Пробне — безкоштовне, одне на учня'],
            ['SUBSCRIPTION', 'З абонемента'],
          ].map(([value, label]) => (
            <label className="admin-check" key={value}>
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value as string)}
              />
              {label}
            </label>
          ))}
        </fieldset>

        {/* A package is chosen by the student it belongs to, so the box only
            appears once the studio has said which reading of "за що" it means.
            Sending both a plan and a package is refused by the schema: the two
            could then disagree about how long the lesson is. */}
        {kind === 'SUBSCRIPTION' ? (
          <Field
            label="Абонемент"
            name="subscriptionId"
            id="book-subscriptionId"
            required
            hint="Ідентифікатор абонемента з екрана «Абонементи»"
            defaultValue={submitted?.['subscriptionId'] ?? ''}
            errors={state.fieldErrors?.['subscriptionId']}
          />
        ) : (
          <p className="field">
            <label className="field-label" htmlFor="book-pricePlanId">
              Тариф
            </label>
            <select
              id="book-pricePlanId"
              name="pricePlanId"
              className="field-input"
              defaultValue={submitted?.['pricePlanId'] ?? ''}
            >
              <option value="">Оберіть тариф</option>
              {plans
                .filter((plan) => plan.isActive && plan.format === 'INDIVIDUAL')
                .map((plan) => (
                  <option value={plan.id} key={plan.id}>
                    {plan.name} · {plan.durationMinutes} хв · {formatUah(plan.priceUah)}
                  </option>
                ))}
            </select>
            {state.fieldErrors?.['pricePlanId']?.[0] ? (
              <span className="field-error">{state.fieldErrors['pricePlanId'][0]}</span>
            ) : null}
          </p>
        )}

        <div className="admin-row__actions">
          <SubmitButton className="admin-button" pendingLabel="Записуємо…">
            Записати
          </SubmitButton>
        </div>
      </form>
    </>
  );
}

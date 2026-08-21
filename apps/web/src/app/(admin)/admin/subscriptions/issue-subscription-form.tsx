'use client';

import type { AdminPricePlan, AdminStudent, AdminTeacher } from '@palitra/shared';
import { useActionState } from 'react';
import { issueSubscriptionAction } from '@/app/actions/admin-operations';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';
import { formatUah } from '@/lib/studio';

/**
 * Selling a package.
 *
 * The count and the price are not asked for: they come from the plan the
 * package is sold against, because a plan of eight lessons recorded as six is
 * a disagreement no screen would ever catch. What the studio decides here is
 * who, with whom, on which plan, for how long - and whether the money is
 * already in the till.
 */
export function IssueSubscriptionForm({
  students,
  teachers,
  plans,
}: {
  students: AdminStudent[];
  teachers: AdminTeacher[];
  plans: AdminPricePlan[];
}) {
  const [state, action] = useActionState(issueSubscriptionAction, emptyFormState);
  const submitted = state.values;

  return (
    <>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done ? <FormAlert tone="ok">Абонемент оформлено.</FormAlert> : null}

      <form className="admin-form" action={action} noValidate>
        <div className="admin-form__row">
          <p className="field">
            <label className="field-label" htmlFor="sub-studentId">
              Учень
            </label>
            <select
              id="sub-studentId"
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
            <label className="field-label" htmlFor="sub-teacherId">
              Викладач
            </label>
            <select
              id="sub-teacherId"
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

        <p className="field">
          <label className="field-label" htmlFor="sub-pricePlanId">
            Тариф
          </label>
          <select
            id="sub-pricePlanId"
            name="pricePlanId"
            className="field-input"
            required
            defaultValue={submitted?.['pricePlanId'] ?? ''}
          >
            <option value="">Оберіть тариф</option>
            {plans
              .filter((plan) => plan.isActive)
              .map((plan) => (
                <option value={plan.id} key={plan.id}>
                  {plan.name} · {plan.lessonsCount} занять по {plan.durationMinutes} хв ·{' '}
                  {formatUah(plan.priceUah)}
                </option>
              ))}
          </select>
          <span className="field-hint">
            Кількість занять і ціну беремо з тарифу — вручну вони не вводяться.
          </span>
          {state.fieldErrors?.['pricePlanId']?.[0] ? (
            <span className="field-error">{state.fieldErrors['pricePlanId'][0]}</span>
          ) : null}
        </p>

        <div className="admin-form__row">
          <Field
            label="Діє від"
            name="validFrom"
            id="sub-validFrom"
            type="date"
            required
            defaultValue={submitted?.['validFrom'] ?? ''}
            errors={state.fieldErrors?.['validFrom']}
          />
          <Field
            label="Діє до"
            name="validTo"
            id="sub-validTo"
            type="date"
            required
            defaultValue={submitted?.['validTo'] ?? ''}
            errors={state.fieldErrors?.['validTo']}
          />
        </div>

        <label className="admin-check">
          <input type="checkbox" name="paid" />
          Оплачено одразу
          <span className="admin-check__hint">
            Готівка на місці — один крок замість двох. Інакше позначите оплату пізніше.
          </span>
        </label>

        <div className="admin-row__actions">
          <SubmitButton className="admin-button" pendingLabel="Оформлюємо…">
            Оформити абонемент
          </SubmitButton>
        </div>
      </form>
    </>
  );
}

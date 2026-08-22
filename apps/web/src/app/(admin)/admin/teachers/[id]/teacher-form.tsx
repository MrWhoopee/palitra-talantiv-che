'use client';

import type { AdminTeacher } from '@palitra/shared';
import { useActionState } from 'react';
import { updateTeacherAction } from '@/app/actions/admin-teachers';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { emptyFormState } from '@/lib/form-state';

/**
 * The whole card in one form, saved in one press.
 *
 * The name lives on the account and the bio on the profile, and the portrait
 * is a file that has to be stored before either can point at it - three
 * requests behind a single "Зберегти", because to the person filling it in
 * this is one card.
 */
export function TeacherForm({ teacher }: { teacher: AdminTeacher }) {
  const [state, action] = useActionState(updateTeacherAction, emptyFormState);
  const submitted = state.values;

  return (
    <>
      {state.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state.done ? <FormAlert tone="ok">Збережено.</FormAlert> : null}

      <form className="admin-form" action={action} noValidate>
        <input type="hidden" name="teacherId" value={teacher.id} />

        <div className="admin-form__row">
          <Field
            label="Ім'я"
            name="firstName"
            required
            defaultValue={submitted?.['firstName'] ?? teacher.firstName}
            errors={state.fieldErrors?.['firstName']}
          />
          <Field
            label="Прізвище"
            name="lastName"
            required
            defaultValue={submitted?.['lastName'] ?? teacher.lastName}
            errors={state.fieldErrors?.['lastName']}
          />
        </div>

        <div className="admin-form__row">
          <Field
            label="Телефон"
            name="phone"
            type="tel"
            required
            defaultValue={submitted?.['phone'] ?? teacher.phone}
            errors={state.fieldErrors?.['phone']}
          />
          <Field
            label="Років досвіду"
            name="experienceYears"
            type="number"
            min={0}
            max={70}
            hint="Можна не заповнювати"
            defaultValue={submitted?.['experienceYears'] ?? teacher.experienceYears ?? ''}
            errors={state.fieldErrors?.['experienceYears']}
          />
        </div>

        <p className="field">
          <label className="field-label" htmlFor="bio">
            Про викладача
          </label>
          <textarea
            id="bio"
            name="bio"
            className="field-input"
            rows={5}
            defaultValue={submitted?.['bio'] ?? teacher.bio ?? ''}
          />
          <span className="field-hint">Кілька речень, які прочитають батьки на сайті.</span>
        </p>

        <PictureBox
          name="photo"
          label="Нове фото"
          missing="Фото ще немає"
          hint="Портрет із телефона годиться — ми самі його зменшимо. До 8 МБ."
          remove="Прибрати нинішнє фото"
          url={teacher.photoUrl}
        />

        <PictureBox
          name="cutout"
          label="Постать для анімації"
          missing="Постаті ще немає"
          hint="Викладач на повний зріст із вирізаним фоном — PNG із прозорістю. Ця світлина стоїть на сцені в режимі анімації; поки її немає, там силует. До 8 МБ."
          remove="Прибрати нинішню постать"
          url={teacher.cutoutUrl}
          onDark
        />

        <fieldset className="admin-switches">
          <legend className="field-label">Де показувати</legend>

          <label className="admin-check">
            <input type="checkbox" name="isPublished" defaultChecked={teacher.isPublished} />
            На сайті
            <span className="admin-check__hint">
              Знято — картки немає в переліку викладачів і сторінка не відкривається.
            </span>
          </label>

          <label className="admin-check">
            <input type="checkbox" name="isActive" defaultChecked={teacher.isActive} />
            Працює в студії
            <span className="admin-check__hint">
              Знято — вільних годин більше не пропонуємо, а проведені заняття лишаються в історії.
            </span>
          </label>
        </fieldset>

        <Field
          label="Порядок у списку"
          name="sortOrder"
          type="number"
          min={0}
          max={1000}
          hint="Менше число — вище в переліку на сайті"
          defaultValue={submitted?.['sortOrder'] ?? teacher.sortOrder}
          errors={state.fieldErrors?.['sortOrder']}
        />

        <SubmitButton className="admin-button" pendingLabel="Зберігаємо…">
          Зберегти
        </SubmitButton>
      </form>
    </>
  );
}

/**
 * One picture on the card: what is there now, a box to replace it, and - only
 * when there is something to remove - the tick that removes it.
 *
 * The card carries two of these and they behave identically, so they are one
 * component. The names the form submits are read back by the same helper in
 * the action, which is what keeps `cutout` and `remove-cutout` spelt the same
 * on both sides.
 */
function PictureBox({
  name,
  label,
  missing,
  hint,
  remove,
  url,
  onDark = false,
}: {
  name: string;
  label: string;
  missing: string;
  hint: string;
  remove: string;
  url: string | null;
  /** A cut-out is mostly transparent, and white on white is not a preview. */
  onDark?: boolean;
}) {
  return (
    <div className="admin-photo">
      {url === null ? (
        <p className="admin-photo__none">{missing}</p>
      ) : (
        // A plain <img>: the address comes from our own uploads and the stored
        // size is known, so there is nothing for next/image to decide here.
        <img
          className={onDark ? 'admin-photo__shot admin-photo__shot--cutout' : 'admin-photo__shot'}
          src={url}
          alt=""
        />
      )}

      <div className="admin-photo__controls">
        <p className="field">
          <label className="field-label" htmlFor={name}>
            {label}
          </label>
          <input id={name} name={name} type="file" accept="image/*" className="field-input" />
          <span className="field-hint">{hint}</span>
        </p>

        {url === null ? null : (
          <label className="admin-check">
            <input type="checkbox" name={`remove-${name}`} />
            {remove}
          </label>
        )}
      </div>
    </div>
  );
}

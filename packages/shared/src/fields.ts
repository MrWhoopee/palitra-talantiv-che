import { z } from 'zod';

/**
 * The field vocabulary the module schemas are built from.
 *
 * A rule that two modules both need lives here rather than in whichever of
 * them happened to need it first: an address typed into the invite form and an
 * address typed into the registration form are the same thing, and a limit
 * that has drifted apart between the two is a bug nobody sees until someone's
 * account cannot be made.
 *
 * Not exported from the package index - these are pieces, and what the outside
 * world validates against are the whole shapes assembled in the other files.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Некоректна адреса електронної пошти' }))
  .refine((value) => value.length <= 254, { message: 'Занадто довга адреса' });

export const nameSchema = z
  .string()
  .trim()
  .min(1, { message: "Обов'язкове поле" })
  .max(80, { message: 'Задовге значення' });

/**
 * Kept permissive on purpose: the studio's contact list already mixes
 * `+380671234567`, `067 123 45 67` and bracketed forms, and rejecting a real
 * phone number costs a booking. Only the digit count is enforced.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, { message: "Обов'язкове поле" })
  .max(32, { message: 'Задовге значення' })
  .regex(/^[+\d][\d\s()-]*$/, { message: 'Некоректний номер телефону' })
  .refine((value) => (value.match(/\d/g) ?? []).length >= 9, {
    message: 'Некоректний номер телефону',
  });

/**
 * A page address. Latin letters only, because it goes into a URL and a
 * transliterated slug survives being pasted into a messenger, while a Cyrillic
 * one arrives as a line of percent signs.
 */
export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'лише латиниця, цифри й дефіси');

/** Trimmed, and empty becomes absent: a form posts "" for a field left alone. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullish()
    .transform((value) => value ?? null);

/**
 * Where a row sits in a hand-arranged list. Bounded because it is typed by a
 * person and a stray keystroke should be a message next to the field rather
 * than a number the ordering can never reach past.
 */
export const sortOrderSchema = z.coerce.number().int().min(0).max(1000);

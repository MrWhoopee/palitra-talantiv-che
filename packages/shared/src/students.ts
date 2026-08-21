import { z } from 'zod';

/**
 * The people the studio teaches, as the studio's own screen lists them.
 *
 * There is no public shape above this one, and there should not be: a student
 * is a child with an address and a phone number, and nothing a visitor reads
 * has any business knowing one exists. This is the only place in the app where
 * that table is listed, and it sits behind `/admin`.
 *
 * The counts come with the row rather than being fetched per student. What the
 * studio does on this screen is decide who to call - about an unpaid package,
 * about a child who has stopped coming - and both questions are answered by a
 * number next to a name, not by opening twenty cards.
 */
export const adminStudentSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  /** Whether reminders can reach them; an unverified address quietly does not. */
  emailVerified: z.boolean(),
  /** Lessons still ahead of them, cancelled ones excluded. */
  upcomingLessons: z.number().int(),
  /** Packages that are live today, whether or not they have been paid for. */
  activeSubscriptions: z.number().int(),
  /** Packages sold and not yet paid for - the reason to pick up the phone. */
  unpaidSubscriptions: z.number().int(),
  /** When they last had a lesson, so a student who drifted away is visible. */
  lastLessonAt: z.iso.datetime().nullable(),
});

export type AdminStudent = z.infer<typeof adminStudentSchema>;

export const adminStudentListSchema = z.array(adminStudentSchema);

/**
 * One box, matched against name, address and phone at once.
 *
 * A studio looking someone up has whichever of the three they were given -
 * a parent's phone from a message, a name half-remembered from a lesson - and
 * asking them to say which field they are typing into would be asking them to
 * do the searching.
 */
export const studentQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
});

export type StudentQuery = z.infer<typeof studentQuerySchema>;

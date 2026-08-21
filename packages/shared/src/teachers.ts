import { z } from 'zod';
import {
  emailSchema,
  nameSchema,
  optionalText,
  phoneSchema,
  slugSchema,
  sortOrderSchema,
} from './fields';

export const locationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  mapUrl: z.string().nullable(),
});

export type Location = z.infer<typeof locationSchema>;

export const directionSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
});

export type Direction = z.infer<typeof directionSchema>;

/**
 * What a teacher looks like to anyone, signed in or not. The bio and the photo
 * are here; the account's email and phone are not - a public teacher list is
 * not a contact dump.
 */
export const publicTeacherSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  bio: z.string().nullable(),
  experienceYears: z.number().int().nonnegative().nullable(),
  photoUrl: z.string().nullable(),
  directions: z.array(directionSchema),
  locations: z.array(locationSchema),
});

export type PublicTeacher = z.infer<typeof publicTeacherSchema>;

export const publicTeacherListSchema = z.array(publicTeacherSchema);

// ---------------------------------------------------------------------------
// What the admin sees and writes. The site reads the shape above; this one is
// the same teacher with everything the studio itself needs to run: the way to
// reach them, the two switches that decide where they appear, and whether the
// invitation has been accepted yet.
// ---------------------------------------------------------------------------

export const adminTeacherSchema = publicTeacherSchema.extend({
  email: z.string(),
  phone: z.string(),
  /** On the public site or not. */
  isPublished: z.boolean(),
  /** Still teaching or not - an inactive teacher takes no new bookings. */
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  /**
   * Whether the invitation has been accepted. The hash itself never leaves the
   * API, only the fact that one exists: that is what the screen needs to decide
   * between "invitation sent" and "working", and it is the difference the
   * re-invite button is enabled by.
   */
  hasPassword: z.boolean(),
});

export type AdminTeacher = z.infer<typeof adminTeacherSchema>;

export const adminTeacherListSchema = z.array(adminTeacherSchema);

/**
 * Everything needed to make an account for someone who is not there. No
 * password: the studio does not invent one for a person and then read it out
 * over the phone. What it sends is a link, and the teacher picks their own.
 */
export const teacherInviteSchema = z.object({
  email: emailSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
});

export type TeacherInvite = z.infer<typeof teacherInviteSchema>;

const teacherFields = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  bio: optionalText(4000),
  experienceYears: z.coerce.number().int().min(0).max(70).nullish().default(null),
  photoUrl: optionalText(500),
  isPublished: z.boolean(),
  isActive: z.boolean(),
  sortOrder: sortOrderSchema,
});

/**
 * Editing a teacher is always a patch: the card is edited a field at a time,
 * and the name lives on the account while the bio lives on the profile - a
 * whole-object PUT would make the screen responsible for sending back parts of
 * a row it never showed.
 */
export const teacherPatchSchema = teacherFields.partial();

export type TeacherPatch = z.infer<typeof teacherPatchSchema>;

/**
 * A whole set at once, for the links a teacher has to the reference tables.
 * Sending the set rather than adding and removing one at a time means the
 * screen and the database cannot end up disagreeing about which subjects
 * someone teaches.
 */
export const teacherLinksSchema = z.object({ ids: z.array(z.uuid()).max(50) });

export type TeacherLinks = z.infer<typeof teacherLinksSchema>;

// ---------------------------------------------------------------------------
// The reference tables. Small, rarely edited, and everything else is built on
// them: an address is what a lesson happens at, a direction is what a price is
// quoted for. That is why they are written from here and not typed in twice.
// ---------------------------------------------------------------------------

/**
 * The rows as the studio edits them: the public shapes plus the place in the
 * list, which visitors never see and the person arranging the page always
 * needs.
 */
export const adminLocationSchema = locationSchema.extend({ sortOrder: z.number().int() });

export type AdminLocation = z.infer<typeof adminLocationSchema>;

export const adminLocationListSchema = z.array(adminLocationSchema);

export const adminDirectionSchema = directionSchema.extend({ sortOrder: z.number().int() });

export type AdminDirection = z.infer<typeof adminDirectionSchema>;

export const adminDirectionListSchema = z.array(adminDirectionSchema);

const locationFields = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(3).max(300),
  mapUrl: optionalText(500),
  sortOrder: sortOrderSchema.default(0),
});

export const locationInputSchema = locationFields;

export type LocationInput = z.infer<typeof locationInputSchema>;

export const locationPatchSchema = locationFields.partial();

export type LocationPatch = z.infer<typeof locationPatchSchema>;

const directionFields = z.object({
  slug: slugSchema,
  name: z.string().trim().min(2).max(120),
  description: optionalText(2000),
  /** The name of an icon in the web app, not a file the studio uploads. */
  icon: optionalText(80),
  sortOrder: sortOrderSchema.default(0),
});

export const directionInputSchema = directionFields;

export type DirectionInput = z.infer<typeof directionInputSchema>;

export const directionPatchSchema = directionFields.partial();

export type DirectionPatch = z.infer<typeof directionPatchSchema>;

/** The price plans are written from the same screen; their shapes live next to
 * what the site reads them as, in `booking.ts`. */

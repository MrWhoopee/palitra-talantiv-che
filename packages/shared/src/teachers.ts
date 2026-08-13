import { z } from 'zod';

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

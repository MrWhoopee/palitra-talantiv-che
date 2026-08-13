import { z } from 'zod';

export const USER_ROLES = ['ADMIN', 'TEACHER', 'STUDENT'] as const;

export type UserRole = (typeof USER_ROLES)[number];

/**
 * bcrypt hashes at most 72 bytes and silently ignores the rest, so the limit
 * is counted in bytes rather than characters: 40 Cyrillic letters are 80 bytes
 * and would otherwise pass a character-based check while only their prefix
 * protected the account.
 */
const BCRYPT_MAX_PASSWORD_BYTES = 72;

const utf8Bytes = new TextEncoder();

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Некоректна адреса електронної пошти' }))
  .refine((value) => value.length <= 254, { message: 'Занадто довга адреса' });

const passwordSchema = z
  .string()
  .min(8, { message: 'Пароль має містити щонайменше 8 символів' })
  .refine((value) => utf8Bytes.encode(value).length <= BCRYPT_MAX_PASSWORD_BYTES, {
    message: 'Пароль задовгий',
  });

const nameSchema = z
  .string()
  .trim()
  .min(1, { message: "Обов'язкове поле" })
  .max(80, { message: 'Задовге значення' });

/**
 * Kept permissive on purpose: the studio's contact list already mixes
 * `+380671234567`, `067 123 45 67` and bracketed forms, and rejecting a real
 * phone number costs a booking. Only the digit count is enforced.
 */
const phoneSchema = z
  .string()
  .trim()
  .min(1, { message: "Обов'язкове поле" })
  .max(32, { message: 'Задовге значення' })
  .regex(/^[+\d][\d\s()-]*$/, { message: 'Некоректний номер телефону' })
  .refine((value) => (value.match(/\d/g) ?? []).length >= 9, {
    message: 'Некоректний номер телефону',
  });

const tokenSchema = z.string().min(1, { message: 'Порожній токен' }).max(512);

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

/**
 * Login deliberately does not reuse `passwordSchema`: tightening the
 * registration rules must never lock out an account created under the old
 * ones. Whether the password is right is decided by the hash comparison.
 */
export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'Введіть пароль' }).max(512),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: tokenSchema,
});

export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const verifyEmailRequestSchema = z.object({
  token: tokenSchema,
});

export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
});

export type PasswordReset = z.infer<typeof passwordResetSchema>;

/**
 * The only user shape that ever leaves the API. It is a closed object, so a
 * service accidentally handing the whole Prisma row to `res.json` drops
 * `passwordHash` instead of publishing it.
 */
export const publicUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: z.enum(USER_ROLES),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  emailVerifiedAt: z.iso.datetime().nullable(),
});

export type PublicUser = z.infer<typeof publicUserSchema>;

export const authResponseSchema = z.object({
  user: publicUserSchema,
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  accessTokenExpiresIn: z.number().int().positive(),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

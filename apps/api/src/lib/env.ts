import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),

  /**
   * Signs the access tokens. Deliberately without a default: a fallback value
   * would travel to production unnoticed and let anyone mint a token for any
   * user. 32 bytes is the HMAC-SHA256 block size - a shorter key adds no
   * strength but hides how weak it is.
   */
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  MAIL_FROM: z.string().default('Палітра талантів <no-reply@palitra-talantiv.local>'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

import { createAdminClient } from '@palitra/api-client';

/**
 * Separate from `api` for the same reason it is a separate client: everything
 * it can reach needs the admin's token, and a screen that imports this one has
 * said out loud which side of the guard it is on.
 */
export const adminApi = createAdminClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
});

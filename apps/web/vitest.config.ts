import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The same `@/*` the app is written against, mirrored from `tsconfig.json`.
  // Without it a module under test can import from the app only by climbing
  // out with `../..`, which is a different import from the one that ships.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

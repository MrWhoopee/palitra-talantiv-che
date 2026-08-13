import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Creates and migrates the test database once per run.
    globalSetup: ['./src/test/global-setup.ts'],
    // Integration tests share one Postgres database and truncate it between
    // tests, so two files running at once would delete each other's rows.
    fileParallelism: false,
  },
});

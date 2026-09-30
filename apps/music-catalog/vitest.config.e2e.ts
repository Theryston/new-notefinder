import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Starts one Postgres (Testcontainers, or E2E_DATABASE_URL), migrates it
    // and hands its URL to the workers (`inject('databaseUrl')`).
    globalSetup: ['./test/setup/global-setup.ts'],
    // Every spec shares that one database and resets it in `beforeEach`, so
    // files must not run concurrently.
    fileParallelism: false,
    // Booting the server (and its first database connection) in `beforeAll`
    // can exceed the 10s default on a cold CI runner.
    hookTimeout: 30_000,
    coverage: {
      // Always on: `test:e2e` fails when it drops below the thresholds.
      enabled: true,
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      reportsDirectory: './coverage-e2e',
      include: ['src/**/*.ts'],
      // Scripts and the worker process run outside the server, and unit
      // specs are not part of this suite.
      exclude: [
        'src/**/*.spec.ts',
        'src/server.ts',
        'src/worker.ts',
        'src/worker/**',
        'src/database/migrate.ts',
      ],
      thresholds: {
        lines: 73,
        branches: 50,
        functions: 76,
        statements: 73,
      },
    },
  },
});

import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Starts one Postgres (Testcontainers, or E2E_DATABASE_URL) and migrates
    // it; database-env.ts points each worker's DATABASE_URL at it.
    globalSetup: ['./test/setup/global-setup.ts'],
    setupFiles: ['./test/setup/database-env.ts'],
    // Every spec shares that one database and resets it in `beforeEach`, so
    // files must not run concurrently.
    fileParallelism: false,
    // Booting the Nest app (and its first database connection) in
    // `beforeAll` can exceed the 10s default on a cold CI runner.
    hookTimeout: 30_000,
    coverage: {
      // Always on: `test:e2e` fails when it drops below the thresholds.
      enabled: true,
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      reportsDirectory: './coverage-e2e',
      include: ['src/**/*.ts'],
      // Scripts run outside the app (tsx) and unit specs.
      exclude: [
        'src/**/*.spec.ts',
        'src/main.ts',
        'src/database/migrate.ts',
        'src/database/seed.ts',
        'src/database/seed-data.ts',
      ],
      thresholds: {
        lines: 73,
        branches: 50,
        functions: 76,
        statements: 73,
      },
    },
    env: {
      // Nothing listens here: e2e specs replace every Redis-backed provider
      // (see test/redis-test-overrides.ts), so they run without Redis.
      REDIS_URL: 'redis://127.0.0.1:1',
    },
  },
});

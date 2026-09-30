import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      // Listing every source file makes untested files count as 0% instead of
      // being left out of the report.
      include: ['src/**/*.ts'],
      // Entrypoints, the composition root, the WebSocket transport,
      // repositories and the DB schema are covered by the e2e suite (see
      // CLAUDE.md "Testing"), not by unit tests.
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.repository.ts',
        'src/database/schema/**',
        'src/database/migrate.ts',
        'src/server.ts',
        'src/worker.ts',
        'src/create-server.ts',
        'src/ws/ws-server.ts',
      ],
      thresholds: {
        lines: 86,
        branches: 75,
        functions: 84,
        statements: 87,
      },
    },
  },
});

import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
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
      // Controllers, repositories, module wiring and the DB schema are covered
      // by the e2e suite (see CLAUDE.md "Testing"), not by unit tests.
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.controller.ts',
        'src/**/*.repository.ts',
        'src/**/*.module.ts',
        'src/database/schema/**',
        'src/main.ts',
        'src/database/migrate.ts',
        'src/database/seed.ts',
      ],
      thresholds: {
        lines: 82,
        branches: 72,
        functions: 79,
        statements: 82,
      },
    },
  },
});

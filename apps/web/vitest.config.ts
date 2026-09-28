import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vite resolves the `@/*` alias from tsconfig.json natively.
  resolve: { tsconfigPaths: true },
  test: {
    // Pure logic only. A file that needs a DOM can opt in with a
    // `// @vitest-environment happy-dom` comment (after adding the package).
    environment: 'node',
    include: ['**/*.test.ts'],
    // Playwright specs live in e2e/ and run with `test:e2e`.
    exclude: ['**/node_modules/**', '.next/**', 'e2e/**'],
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      // Listing every source file makes untested files count as 0% instead of
      // being left out of the report. Components (.tsx) are covered by the
      // Playwright suite, so only plain logic modules are measured here.
      include: [
        'app/**/*.ts',
        'cache-handlers/**/*.ts',
        'features/**/*.ts',
        'hooks/**/*.ts',
        'lib/**/*.ts',
        'proxy.ts',
      ],
      exclude: ['**/*.test.ts', 'cache-handlers/fake-redis.ts'],
      thresholds: {
        lines: 87,
        branches: 83,
        functions: 80,
        statements: 86,
      },
    },
  },
});

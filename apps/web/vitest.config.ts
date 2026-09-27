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
  },
});

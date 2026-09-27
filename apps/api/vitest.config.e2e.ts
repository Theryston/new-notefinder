import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      // Required by the env schema. Nothing connects to it yet: the pool only
      // opens connections on the first query. Replaced by a Testcontainers
      // Postgres once e2e tests hit the database.
      DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:1/unused',
    },
  },
});

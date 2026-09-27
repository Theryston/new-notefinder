import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      // Nothing listens here: e2e specs replace every Redis-backed provider
      // (see test/redis-test-overrides.ts), so they run without Redis.
      REDIS_URL: 'redis://127.0.0.1:1',
    },
  },
});

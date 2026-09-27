import { defineConfig, devices } from '@playwright/test';

import { webServerEnv } from './e2e/web-server-env';

const port = 3000;
const baseURL = `http://localhost:${port}`;
const isCI = Boolean(process.env.CI);

/**
 * E2E tests run against a production build (`next start`), so they see the
 * same proxy, prerendering and caching behavior as production. The build
 * itself is not done here: Turbo's `web#test:e2e` depends on `web#build`
 * (cached), so `nub run test:e2e` never builds twice. Running Playwright
 * directly requires `nub run build --filter=web` first.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `next start --port ${port}`,
    url: baseURL,
    env: webServerEnv,
    // Never attach to a `next dev` server left running on the same port:
    // its behavior differs from production and would hide real failures.
    reuseExistingServer: false,
    stdout: 'pipe',
    timeout: 60_000,
  },
});

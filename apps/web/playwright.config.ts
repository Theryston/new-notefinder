import { defineConfig, devices } from '@playwright/test';

import { webServerEnv } from './e2e/web-server-env';

const port = 3000;
const baseURL = `http://localhost:${port}`;
const isCI = Boolean(process.env.CI);

/**
 * E2E tests run against a production build (`next start`), so they see the
 * same proxy, prerendering and caching behavior as production. The
 * `test:e2e` script always runs `next build` first (from the repo root or from
 * apps/web), so a stale `.next` left over from another branch is never tested.
 * Running `playwright test` by hand skips that build.
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
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Escape hatch for machines with a preinstalled Chromium that doesn't
        // match this Playwright version (and can't download one). CI leaves
        // it unset and uses `playwright install`.
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        },
      },
    },
  ],
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

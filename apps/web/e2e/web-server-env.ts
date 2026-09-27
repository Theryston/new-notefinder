/**
 * Env for the production server Playwright starts. Dummy but valid values:
 * `instrumentation.ts` refuses to boot without them, and no test talks to a
 * real API yet.
 */
export const webServerEnv = {
  API_URL: 'http://127.0.0.1:3333',
  NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3333',
  REVALIDATE_SECRET: 'e2e-revalidate-secret-not-used-anywhere-else',
} as const;

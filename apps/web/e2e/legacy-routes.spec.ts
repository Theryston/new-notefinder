import { expect, test } from '@playwright/test';

import { legacyRoutes } from './legacy-routes';

const localeCases = [
  { locale: 'en', headers: {} },
  { locale: 'pt-BR', headers: { 'cf-ipcountry': 'BR' } },
] as const;

test.describe('legacy routes', () => {
  for (const route of legacyRoutes) {
    if (route.todo) {
      // Sitemaps keep their unprefixed URL, so the only requirement is that
      // they resolve.
      // biome-ignore lint/suspicious/noSkippedTests: routes flagged `todo` are not built yet; `fixme` keeps them listed in the report until they ship (see apps/web/CLAUDE.md "Legacy routes").
      test.fixme(`${route.path} does not 404 (todo: ${route.todo})`, async ({
        request,
      }) => {
        const response = await request.get(route.path);
        expect(response.status()).not.toBe(404);
      });
      continue;
    }

    for (const { locale, headers } of localeCases) {
      test(`${route.path} redirects to /${locale}`, async ({
        request,
        baseURL,
      }) => {
        const response = await request.get(route.path, {
          headers,
          maxRedirects: 0,
        });

        expect(response.status()).toBe(307);

        const legacy = new URL(route.path, baseURL);
        const pathname =
          legacy.pathname === '/'
            ? `/${locale}`
            : `/${locale}${legacy.pathname}`;
        const location = new URL(response.headers().location ?? '', baseURL);
        expect(location.pathname).toBe(pathname);
        // Compared decoded: Next re-serializes the query (`/` → `%2F`,
        // `%20` → `+`), which is equivalent for every server and browser.
        expect([...location.searchParams]).toEqual([...legacy.searchParams]);

        if (route.implemented) {
          // Follows further redirects (e.g. an auth-only page to sign-in):
          // what matters is that the visitor lands on a working page.
          const target = await request.get(location.href);
          expect(target.status(), `${target.url()} status`).not.toBe(404);
          expect(target.ok(), `${target.url()} status`).toBe(true);
        }
      });
    }
  }
});

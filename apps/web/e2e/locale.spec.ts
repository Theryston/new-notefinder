import { expect, test } from '@playwright/test';

import { messages as catalogs } from './messages';

async function redirectTarget(
  response: { status(): number; headers(): Record<string, string> },
  baseURL: string | undefined,
) {
  expect(response.status()).toBe(307);
  return new URL(response.headers().location ?? '', baseURL).pathname;
}

test.describe('locale redirect for unprefixed URLs', () => {
  const cases = [
    { name: 'defaults to en without any signal', headers: {}, locale: 'en' },
    {
      name: 'uses the country header',
      headers: { 'cf-ipcountry': 'BR' },
      locale: 'pt-BR',
    },
    {
      name: 'uses Accept-Language',
      headers: { 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8' },
      locale: 'pt-BR',
    },
    {
      name: 'prefers the country over Accept-Language',
      headers: { 'cf-ipcountry': 'PT', 'accept-language': 'en-US' },
      locale: 'pt-BR',
    },
    {
      name: 'lets the locale cookie beat the country',
      headers: { 'cf-ipcountry': 'BR', cookie: 'NEXT_LOCALE=en' },
      locale: 'en',
    },
    {
      name: 'ignores an invalid locale cookie',
      headers: { 'cf-ipcountry': 'BR', cookie: 'NEXT_LOCALE=fr' },
      locale: 'pt-BR',
    },
  ] as const;

  for (const { name, headers, locale } of cases) {
    test(`${name} → /${locale}`, async ({ request, baseURL }) => {
      const response = await request.get('/', { headers, maxRedirects: 0 });
      expect(await redirectTarget(response, baseURL)).toBe(`/${locale}`);
    });
  }

  test('is private, uncacheable and sets no cookie', async ({ request }) => {
    const response = await request.get('/tracks/abc?x=1', {
      headers: { 'cf-ipcountry': 'BR' },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    const responseHeaders = response.headers();
    expect(responseHeaders['cache-control']).toBe('private, no-store');
    expect(responseHeaders.vary).toMatch(/cookie/i);
    expect(responseHeaders.vary).toMatch(/cf-ipcountry/i);
    expect(responseHeaders.vary).toMatch(/accept-language/i);
    expect(responseHeaders['set-cookie']).toBeUndefined();
  });
});

test.describe('locale-prefixed pages', () => {
  const pages = [
    { locale: 'en', messages: catalogs.en },
    { locale: 'pt-BR', messages: catalogs['pt-BR'] },
  ] as const;

  for (const { locale, messages } of pages) {
    test(`/${locale} renders in ${locale}`, async ({ page }) => {
      const response = await page.goto(`/${locale}`);
      expect(response?.status()).toBe(200);

      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(
        page.getByRole('heading', { level: 1, name: messages.home.title }),
      ).toBeVisible();
      await expect(page).toHaveTitle(messages.metadata.title);

      const alternate = (hreflang: string) =>
        page.locator(`head link[rel="alternate"][hreflang="${hreflang}"]`);
      await expect(alternate('en')).toHaveAttribute('href', /\/en$/);
      await expect(alternate('pt-BR')).toHaveAttribute('href', /\/pt-BR$/);
      await expect(alternate('x-default')).toHaveAttribute(
        'href',
        /^(https?:\/\/[^/]+)?\/$/,
      );
      await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
        'href',
        new RegExp(`/${locale}$`),
      );
    });
  }

  // A prefixed URL is always respected and never personalized, so it stays
  // cacheable by the CDN.
  for (const path of ['/en', '/pt-BR', '/en/tracks/abc?x=1']) {
    test(`${path} is not redirected and sets no cookie`, async ({
      request,
    }) => {
      const response = await request.get(path, {
        headers: { 'cf-ipcountry': 'BR', cookie: 'NEXT_LOCALE=pt-BR' },
        maxRedirects: 0,
      });

      expect(response.status()).not.toBe(307);
      expect(response.status()).not.toBe(308);
      expect(response.headers()['set-cookie']).toBeUndefined();
    });
  }
});

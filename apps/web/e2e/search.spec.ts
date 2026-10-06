import { expect, type Page, type Request, test } from '@playwright/test';

import { mockAuthApi } from './auth-api-mock';
import { messages as catalogs } from './messages';
import { mockSearchApi, searchParamsOf } from './search-api-mock';

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;

/** The header is hydrated once its account links render in the browser. */
const headerReady = (page: Page, signIn: string) =>
  expect(
    page.getByRole('banner').getByRole('link', { name: signIn }),
  ).toBeVisible();

const headerField = (page: Page, label: string) =>
  page.getByRole('banner').getByRole('searchbox', { name: label });

const pageField = (page: Page, label: string) =>
  page.getByRole('main').getByRole('searchbox', { name: label });

function lastRequest(calls: Request[]): Request {
  const last = calls[calls.length - 1];
  if (!last) throw new Error('expected at least one search request');
  return last;
}

for (const { locale, messages } of cases) {
  test.describe(`search (${locale})`, () => {
    test('header submit opens the search page with the query', async ({
      page,
    }) => {
      await mockAuthApi(page);
      const search = await mockSearchApi(page);
      await page.goto(`/${locale}`);
      await headerReady(page, messages.header.account.signIn);

      const header = headerField(page, messages.header.search.label);
      await header.fill('queen');
      await header.press('Enter');

      await expect(page).toHaveURL(`/${locale}/search?q=queen`);
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: messages.search.title,
        }),
      ).toBeVisible();
      const field = pageField(page, messages.search.field.label);
      await expect(field).toHaveValue('queen');
      await expect(
        page.getByRole('main').getByText('Bohemian Rhapsody'),
      ).toBeVisible();
      expect(searchParamsOf(lastRequest(search.calls))).toMatchObject({
        query: 'queen',
        scope: 'metadata',
      });
      // The Lyrics toggle lives only on the search page, never in the header.
      await expect(
        page
          .getByRole('banner')
          .getByRole('button', { name: messages.search.scope.lyrics }),
      ).toHaveCount(0);
    });

    test('header submit from the search page keeps lyrics scope', async ({
      page,
    }) => {
      await mockAuthApi(page);
      const search = await mockSearchApi(page);
      await page.goto(`/${locale}/search?q=queen&scope=lyrics`);

      const field = pageField(page, messages.search.field.label);
      await expect(field).toHaveValue('queen');
      const header = headerField(page, messages.header.search.label);
      await header.fill('abba');
      await header.press('Enter');

      await expect(page).toHaveURL(/q=abba/);
      await expect(page).toHaveURL(/scope=lyrics/);
      await expect(field).toHaveValue('abba');
      const abba = [...search.calls]
        .reverse()
        .find((call) => searchParamsOf(call).query === 'abba');
      if (!abba) throw new Error('expected a search request for abba');
      expect(searchParamsOf(abba).scope).toBe('lyrics');

      // The existing shortcut still focuses the header search.
      await headerReady(page, messages.header.account.signIn);
      await page.keyboard.press('Control+k');
      await expect(header).toBeFocused();
    });

    test('typing updates the url in place without losing focus', async ({
      page,
    }) => {
      await mockAuthApi(page);
      await mockSearchApi(page);
      await page.goto(`/${locale}/search?q=q&scope=lyrics`);

      const field = pageField(page, messages.search.field.label);
      await expect(field).toHaveValue('q');
      // Below 2 characters nothing searches yet: the prompt explains where
      // to type.
      await expect(
        page
          .getByRole('main')
          .getByRole('heading', { name: messages.search.prompt.title }),
      ).toBeVisible();

      await field.fill('queen');
      await expect(field).toBeFocused();
      await expect(page).toHaveURL(/q=queen/);
      await expect(page).toHaveURL(/scope=lyrics/);
      await expect(
        page.getByRole('main').getByText('Bohemian Rhapsody'),
      ).toBeVisible();
      await expect(field).toBeFocused();
    });

    test('scope toggle switches metadata and lyrics', async ({ page }) => {
      await mockAuthApi(page);
      const search = await mockSearchApi(page);
      await page.goto(`/${locale}/search?q=queen`);

      const main = page.getByRole('main');
      const lyrics = main.getByRole('button', {
        name: messages.search.scope.lyrics,
      });
      const metadata = main.getByRole('button', {
        name: messages.search.scope.metadata,
      });
      await expect(lyrics).toHaveAttribute('aria-pressed', 'false');

      await lyrics.click();
      await expect(page).toHaveURL(/scope=lyrics/);
      await expect(lyrics).toHaveAttribute('aria-pressed', 'true');
      const scoped = [...search.calls]
        .reverse()
        .find((call) => searchParamsOf(call).scope === 'lyrics');
      if (!scoped) throw new Error('expected a lyrics search request');

      await metadata.click();
      await expect(page).not.toHaveURL(/scope=/);
      await expect(metadata).toHaveAttribute('aria-pressed', 'true');
    });

    test('shows a skeleton while results load', async ({ page }) => {
      await mockAuthApi(page);
      await mockSearchApi(page, { delayMs: 1500 });
      await page.goto(`/${locale}/search?q=queen`);

      await expect(
        page.getByRole('status', { name: messages.search.loading }),
      ).toBeVisible();
      await expect(
        page.getByRole('main').getByText('Bohemian Rhapsody'),
      ).toBeVisible();
    });

    test('shows an empty state when nothing matches', async ({ page }) => {
      await mockAuthApi(page);
      await mockSearchApi(page, { emptyResults: true });
      await page.goto(`/${locale}/search?q=xyzabc`);

      const main = page.getByRole('main');
      await expect(
        main.getByRole('heading', { name: messages.search.empty.title }),
      ).toBeVisible();
      await expect(
        main.getByText(
          messages.search.empty.description.replace('{query}', 'xyzabc'),
        ),
      ).toBeVisible();
    });

    test('shows an error with retry when the catalog is down', async ({
      page,
    }) => {
      await mockAuthApi(page);
      const search = await mockSearchApi(page, { shouldFail: true });
      await page.goto(`/${locale}/search?q=queen`);

      const main = page.getByRole('main');
      await expect(
        main.getByRole('heading', { name: messages.search.error.title }),
      ).toBeVisible({ timeout: 20_000 });
      await expect(
        main.getByText(messages.search.error.description),
      ).toBeVisible();

      search.shouldFail = false;
      await main
        .getByRole('button', { name: messages.search.error.retry })
        .click();
      await expect(main.getByText('Bohemian Rhapsody')).toBeVisible();
    });

    test('links processed recordings and keeps others static', async ({
      page,
    }) => {
      await mockAuthApi(page);
      await mockSearchApi(page);
      await page.goto(`/${locale}/search?q=queen`);

      const main = page.getByRole('main');
      const linked = main.getByRole('link', { name: /Bohemian Rhapsody/ });
      await expect(linked).toHaveAttribute(
        'href',
        /\/tracks\/clxlinkedtrack01/,
      );
      await linked.click();
      // The Track page itself ships later: what matters is that the card
      // navigates toward it.
      await expect(page).toHaveURL(/\/tracks\/clxlinkedtrack01/);

      await page.goBack();
      await expect(main.getByText('Unreleased Demo')).toBeVisible();
      await expect(
        main.getByRole('link', { name: /Unreleased Demo/ }),
      ).toHaveCount(0);
    });

    test('pages through more results', async ({ page }) => {
      await mockAuthApi(page);
      await mockSearchApi(page, { totalCount: 25 });
      await page.goto(`/${locale}/search?q=queen`);

      const main = page.getByRole('main');
      await expect(main.getByText('Song 20', { exact: true })).toBeVisible();
      await main.getByText('Song 20', { exact: true }).scrollIntoViewIfNeeded();
      await expect(main.getByText('Song 25', { exact: true })).toBeVisible();
    });
  });
}

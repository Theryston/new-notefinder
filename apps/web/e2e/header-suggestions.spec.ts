import { expect, type Page, test } from '@playwright/test';

import { mockAuthApi } from './auth-api-mock';
import { messages as catalogs } from './messages';
import { mockSearchApi, searchParamsOf } from './search-api-mock';

const localeCatalogs = (['en', 'pt-BR'] as const).map((locale) => ({
  locale,
  messages: catalogs[locale],
}));

for (const { locale, messages } of localeCatalogs) {
  const suggestions = messages.header.search.suggestions;
  const searchFor = (query: string) =>
    suggestions.searchFor.replace('{query}', query);

  test.describe(`header suggestions (${locale})`, () => {
    const field = (page: Page) =>
      page
        .getByRole('banner')
        .getByRole('searchbox', { name: messages.header.search.label });
    const list = (page: Page) =>
      page.getByRole('group', { name: suggestions.label });

    /** Opens home with auth and search mocked and waits for the header. */
    async function openHome(
      page: Page,
      overrides: Parameters<typeof mockSearchApi>[1] = {},
    ) {
      await mockAuthApi(page);
      const search = await mockSearchApi(page, overrides);
      await page.goto(`/${locale}`);
      await expect(
        page
          .getByRole('banner')
          .getByRole('link', { name: messages.header.account.signIn }),
      ).toBeVisible();
      return { search, home: page.url(), header: field(page) };
    }

    test('typing lists the matches in rank order without navigating', async ({
      page,
    }) => {
      const { home, header, search } = await openHome(page);

      await header.fill('queen');
      const rows = list(page).getByRole('listitem');
      // Two Recordings plus the trailing Search-for row.
      await expect(rows).toHaveCount(3);
      await expect(rows.nth(0)).toContainText('Bohemian Rhapsody');
      await expect(rows.nth(0)).toContainText('Queen');
      await expect(rows.nth(1)).toContainText('Unreleased Demo');
      await expect(rows.nth(2)).toContainText(searchFor('queen'));

      const last = search.calls.at(-1);
      if (!last) throw new Error('expected a suggestions request');
      expect(searchParamsOf(last)).toMatchObject({
        query: 'queen',
        scope: 'metadata',
        limit: '6',
      });
      await expect(page).toHaveURL(home);
    });

    test('a suggestion with a Track opens its Track page', async ({ page }) => {
      const { header } = await openHome(page);

      await header.fill('queen');
      await list(page)
        .getByRole('link', { name: /Bohemian Rhapsody/ })
        .click();
      await expect(page).toHaveURL(/\/tracks\/clxlinkedtrack01/);
    });

    test('the Search-for row goes to the full search', async ({ page }) => {
      const { header } = await openHome(page);

      await header.fill('queen');
      await list(page)
        .getByRole('link', { name: searchFor('queen') })
        .click();
      await expect(page).toHaveURL(`/${locale}/search?q=queen`);
      await expect(
        page.getByRole('main').getByText('Bohemian Rhapsody'),
      ).toBeVisible();
    });

    test('an empty match says no songs and keeps the Search-for row', async ({
      page,
    }) => {
      const { header } = await openHome(page, { emptyResults: true });

      await header.fill('xyzabc');
      await expect(list(page).getByText(suggestions.noSongs)).toBeVisible();
      await expect(
        list(page).getByRole('link', { name: searchFor('xyzabc') }),
      ).toBeVisible();
    });

    test('the list stays off on the search page', async ({ page }) => {
      await mockAuthApi(page);
      await mockSearchApi(page);
      await page.goto(`/${locale}/search`);

      const header = field(page);
      await header.fill('queen');
      await expect(page).toHaveURL(/q=queen/);
      await expect(list(page)).toHaveCount(0);
    });

    test('blurring closes the list without navigating', async ({ page }) => {
      const { header, home } = await openHome(page);

      await header.fill('queen');
      await expect(list(page)).toBeVisible();
      await header.blur();
      await expect(list(page)).toHaveCount(0);
      await expect(page).toHaveURL(home);
    });

    test('a click outside closes the list without navigating', async ({
      page,
    }) => {
      const { header, home } = await openHome(page);

      await header.fill('queen');
      await expect(list(page)).toBeVisible();
      await page.mouse.click(5, 600);
      await expect(list(page)).toHaveCount(0);
      await expect(page).toHaveURL(home);
    });

    test('focusing a field with text reopens the cached suggestions', async ({
      page,
    }) => {
      const { header, search } = await openHome(page);

      await header.fill('queen');
      await expect(
        list(page).getByRole('link', { name: /Bohemian Rhapsody/ }),
      ).toBeVisible();
      await header.blur();
      await expect(list(page)).toHaveCount(0);

      const requests = search.calls.length;
      await header.focus();
      await expect(
        list(page).getByRole('link', { name: /Bohemian Rhapsody/ }),
      ).toBeVisible();
      expect(search.calls).toHaveLength(requests);
    });
  });
}

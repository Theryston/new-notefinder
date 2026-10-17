import { expect, type Page, test } from '@playwright/test';

import { mockAuthApi } from './auth-api-mock';
import { messages as catalogs } from './messages';
import { mockSearchApi, searchParamsOf } from './search-api-mock';

// 1×1 PNG as a data URL: next/image renders it as-is (no remote fetch), so
// the suggestion shows a real cover instead of its placeholder.
const COVER_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;

for (const { locale, messages } of cases) {
  test.describe(`header suggestions (${locale})`, () => {
    const searchFor = (query: string) =>
      messages.header.search.searchFor.replace('{query}', query);
    const listboxOf = (page: Page) =>
      page.getByRole('listbox', {
        name: messages.header.search.suggestions,
      });
    const headerField = (page: Page) =>
      page.getByRole('banner').getByRole('searchbox', {
        name: messages.header.search.label,
      });

    /**
     * Opens home with auth and search mocked, returning the field, the
     * starting URL and the search calls to assert with. The linked hit
     * carries cover art, so its suggestion shows a cover while the others
     * show the placeholder.
     */
    async function openHome(
      page: Page,
      overrides: Parameters<typeof mockSearchApi>[1] = {},
    ) {
      await mockAuthApi(page);
      const search = await mockSearchApi(page, {
        linked: {
          title: 'Bohemian Rhapsody',
          artist: 'Queen',
          trackId: 'clxlinkedtrack01',
          coverArtUrl: COVER_URL,
        },
        ...overrides,
      });
      await page.goto(`/${locale}`);
      await expect(
        page.getByRole('banner').getByRole('link', {
          name: messages.header.account.signIn,
        }),
      ).toBeVisible();
      return { search, home: page.url(), header: headerField(page) };
    }

    test('typing shows rank-ordered suggestions without navigating', async ({
      page,
    }) => {
      const { search, home, header } = await openHome(page, {
        totalCount: 8,
      });

      await header.fill('queen');
      const listbox = listboxOf(page);
      const rows = listbox.locator('xpath=./*');
      // Up to 6 suggestions plus the trailing Search-for row.
      await expect(rows).toHaveCount(7);
      await expect(rows.nth(0)).toContainText('Bohemian Rhapsody');
      await expect(rows.nth(0)).toContainText('Queen');
      await expect(rows.nth(1)).toContainText('Unreleased Demo');
      await expect(rows.nth(1)).toContainText('Unknown Artist');
      await expect(rows.nth(2)).toContainText('Song 3');
      await expect(rows.nth(5)).toContainText('Song 6');
      await expect(rows.nth(6)).toContainText(searchFor('queen'));
      await expect(page).toHaveURL(home);

      // The same rank order as the full search: one metadata fetch of 6.
      const calls = search.calls.filter(
        (call) => searchParamsOf(call).limit === '6',
      );
      expect(calls.length).toBeGreaterThan(0);
      const last = calls[calls.length - 1];
      if (!last) throw new Error('expected a suggestions request');
      expect(searchParamsOf(last)).toMatchObject({
        query: 'queen',
        scope: 'metadata',
        limit: '6',
      });
    });

    test('each suggestion shows cover or placeholder, title and artist', async ({
      page,
    }) => {
      const { header } = await openHome(page);

      await header.fill('queen');
      const listbox = listboxOf(page);
      // Rows carry the option role (which overrides the link role), so the
      // Track link is found as an option.
      const linked = listbox.getByRole('option', {
        name: /Bohemian Rhapsody/,
      });
      await expect(linked).toBeVisible();
      await expect(linked.locator('img')).toHaveCount(1);

      // Without art the placeholder stands in: title and artist stay readable.
      const unlinked = listbox.getByText('Unreleased Demo');
      await expect(unlinked).toBeVisible();
      await expect(listbox.getByText('Unknown Artist')).toBeVisible();
    });

    test('click opens the Track page of a suggestion with a Track', async ({
      page,
    }) => {
      const { header } = await openHome(page);

      await header.fill('queen');
      const suggestion = listboxOf(page).getByRole('option', {
        name: /Bohemian Rhapsody/,
      });
      await expect(suggestion).toHaveAttribute(
        'href',
        `/${locale}/tracks/clxlinkedtrack01`,
      );
      await suggestion.click();
      await expect(page).toHaveURL(`/${locale}/tracks/clxlinkedtrack01`);
    });

    test('clicking a suggestion without a Track stays on the page', async ({
      page,
    }) => {
      const { home, header } = await openHome(page);

      await header.fill('queen');
      const listbox = listboxOf(page);
      await listbox.getByText('Unreleased Demo').click();
      await expect(page).toHaveURL(home);
      // Static until its own change wires the request and sign-in flows: the
      // click navigates nowhere, and the blur it causes closes the list.
      await expect(listbox).toBeHidden();
    });

    test('Search-for navigates to the full search with the normalized query', async ({
      page,
    }) => {
      const { header } = await openHome(page);

      await header.fill('  queen ');
      const searchForRow = listboxOf(page).getByRole('option', {
        name: searchFor('queen'),
      });
      await expect(searchForRow).toHaveAttribute(
        'href',
        `/${locale}/search?q=queen`,
      );
      await searchForRow.click();
      await expect(page).toHaveURL(`/${locale}/search?q=queen`);
    });

    test('empty match shows No-songs-found with the Search-for row', async ({
      page,
    }) => {
      const { header } = await openHome(page, { emptyResults: true });

      await header.fill('xyzabc');
      const listbox = listboxOf(page);
      await expect(
        listbox.getByText(messages.header.search.noResults),
      ).toBeVisible();
      // The full search stays reachable, e.g. for Lyrics.
      const searchForRow = listbox.getByRole('option', {
        name: searchFor('xyzabc'),
      });
      await expect(searchForRow).toBeVisible();
      await searchForRow.click();
      await expect(page).toHaveURL(`/${locale}/search?q=xyzabc`);
    });

    test('no list on the search page', async ({ page }) => {
      await mockAuthApi(page);
      await mockSearchApi(page);
      await page.goto(`/${locale}/search?q=queen`);

      const header = headerField(page);
      await expect(header).toHaveValue('queen');
      await header.fill('queen live');

      // Typing updates the grid and `q` in place instead.
      await expect(page).toHaveURL(/q=queen\+live/);
      await expect(
        page.getByRole('main').getByText('Bohemian Rhapsody'),
      ).toBeVisible();
      await expect(listboxOf(page)).toHaveCount(0);
    });

    test('blur and outside click close the list without navigating', async ({
      page,
    }) => {
      const { home, header } = await openHome(page);

      await header.fill('queen');
      const listbox = listboxOf(page);
      await expect(listbox).toBeVisible();

      await header.blur();
      await expect(listbox).toBeHidden();
      await expect(page).toHaveURL(home);

      await header.focus();
      await expect(listbox).toBeVisible();
      await page
        .getByRole('heading', { level: 1, name: messages.home.title })
        .click();
      await expect(listbox).toBeHidden();
      await expect(page).toHaveURL(home);
    });

    test('focusing a field that still has text reopens cached suggestions', async ({
      page,
    }) => {
      const { search, header } = await openHome(page);

      await header.fill('queen');
      const listbox = listboxOf(page);
      await expect(
        listbox.getByRole('option', { name: /Bohemian Rhapsody/ }),
      ).toBeVisible();
      const calls = search.calls.length;
      expect(calls).toBeGreaterThan(0);

      await header.blur();
      await expect(listbox).toBeHidden();

      // The rows come back from the cache: no second request.
      await header.focus();
      await expect(
        listbox.getByRole('option', { name: /Bohemian Rhapsody/ }),
      ).toBeVisible();
      expect(search.calls.length).toBe(calls);
    });

    test('the list stays closed while the field is blank', async ({ page }) => {
      const { search, header } = await openHome(page);

      await header.focus();
      await page.waitForTimeout(500);
      await expect(listboxOf(page)).toHaveCount(0);
      expect(search.calls).toHaveLength(0);

      await header.fill('queen');
      await expect(listboxOf(page)).toBeVisible();
      await header.fill('');
      await expect(listboxOf(page)).toBeHidden();
    });
  });
}

test.describe('header suggestions (mobile)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const { header: headerMessages } = catalogs.en;

  async function openExpandedSearch(page: Page) {
    await mockAuthApi(page);
    await mockSearchApi(page);
    await page.goto('/en');
    await page
      .getByRole('button', { name: headerMessages.search.open })
      .click();
    return page.getByRole('banner').getByRole('searchbox', {
      name: headerMessages.search.label,
    });
  }

  test('tap opens the Track page from a suggestion', async ({ page }) => {
    const field = await openExpandedSearch(page);

    await field.fill('queen');
    const suggestion = page
      .getByRole('listbox', { name: headerMessages.search.suggestions })
      .getByRole('option', { name: /Bohemian Rhapsody/ });
    await expect(suggestion).toBeVisible();
    await suggestion.tap();
    await expect(page).toHaveURL('/en/tracks/clxlinkedtrack01');
  });

  test('tap on Search-for navigates to the full search', async ({ page }) => {
    const field = await openExpandedSearch(page);

    await field.fill('queen');
    const searchForRow = page
      .getByRole('listbox', { name: headerMessages.search.suggestions })
      .getByRole('option', {
        name: headerMessages.search.searchFor.replace('{query}', 'queen'),
      });
    await expect(searchForRow).toBeVisible();
    await searchForRow.tap();
    await expect(page).toHaveURL('/en/search?q=queen');
  });
});

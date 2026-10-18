import {
  expect,
  type Locator,
  type Page,
  type Request,
  type Route,
  test,
} from '@playwright/test';

import { mockAuthApi } from './auth-api-mock';
import { type FakeTrack, setTrackMock } from './fake-track-api';
import { messages as catalogs } from './messages';
import { corsHeaders, searchParamsOf } from './search-api-mock';

const localeCatalogs = (['en', 'pt-BR'] as const).map((locale) => ({
  locale,
  messages: catalogs[locale],
}));

/**
 * A 1x1 PNG answered for every optimized image: the browser asks the Next
 * image route, so the cover is the browser's own request and no upstream
 * (the Cover Art Archive) is reached.
 */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

const mbidOf = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A Cover Art Archive front of a release (the image route is answered above). */
const coverOf = (n: number): string =>
  `https://coverartarchive.org/release/${mbidOf(n)}/front-500`;

type Hit = {
  title: string;
  artist: string;
  trackId: string | null;
  coverArtUrl?: string;
};

/**
 * Six Recordings in the order the catalog ranks them. The order is neither
 * alphabetical nor "Tracks first" (the first hit has no Track), so a sort
 * or a reorder by Track status shows up in the row assertions.
 */
const RANKED: Hit[] = [
  {
    title: 'Under Pressure',
    artist: 'Queen & David Bowie',
    trackId: null,
    coverArtUrl: coverOf(101),
  },
  { title: 'Radio Ga Ga', artist: 'Queen', trackId: 'seedtrack02' },
  { title: 'Bohemian Rhapsody', artist: 'Queen', trackId: 'seedtrack01' },
  { title: 'We Will Rock You', artist: 'Queen', trackId: 'seedtrack03' },
  { title: 'Killer Queen', artist: 'Queen', trackId: 'seedtrack04' },
  { title: 'Somebody to Love', artist: 'Queen', trackId: null },
];

function resultBody(hit: Hit, index: number) {
  return {
    mbid: mbidOf(index + 1),
    title: hit.title,
    lengthMs: null,
    disambiguation: '',
    video: false,
    artistCredit: { name: hit.artist, artists: [] },
    genres: [],
    primaryRelease: hit.coverArtUrl
      ? {
          mbid: mbidOf(index + 500),
          title: hit.title,
          year: 1980,
          coverArtUrl: hit.coverArtUrl,
        }
      : null,
    trackId: hit.trackId,
  };
}

/**
 * Serves the public search for the header suggestions. Like the API, it
 * answers at most `limit` hits in the order given. Returns the requests seen.
 */
async function mockSuggestions(page: Page, hits: Hit[] = RANKED) {
  const calls: Request[] = [];
  await page.route('**/v1/search**', async (route: Route) => {
    const request = route.request();
    const headers = corsHeaders(request);
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    calls.push(request);
    const limit = Number(
      new URL(request.url()).searchParams.get('limit') ?? 20,
    );
    await route.fulfill({
      status: 200,
      headers,
      body: JSON.stringify({ results: hits.slice(0, limit).map(resultBody) }),
    });
  });
  return calls;
}

/**
 * Registers a processed Track with the fake track API, so its Track page
 * renders (an unknown ID is a 404 page without the site header).
 */
async function registerTrack(id: string) {
  const track: FakeTrack = {
    id,
    title: 'Radio Ga Ga',
    artistCredit: [{ name: 'Queen', joinPhrase: '' }],
    durationMs: 248_000,
    processing: { status: 'COMPLETED' },
    notes: [{ pitch: 64, start: 2, end: 3 }],
    contributors: [],
  };
  await setTrackMock({ tracks: [track] });
}

function lastOf(calls: Request[]): Request {
  const last = calls.at(-1);
  if (!last) throw new Error('expected a suggestions request');
  return last;
}

for (const { locale, messages } of localeCatalogs) {
  const suggestions = messages.header.search.suggestions;
  const searchForLabel = (query: string) =>
    suggestions.searchFor.replace('{query}', query);

  /** The header field and its locator helpers, shared by every test below. */
  const header = (page: Page) =>
    page
      .getByRole('banner')
      .getByRole('combobox', { name: messages.header.search.label });
  const list = (page: Page) =>
    page.getByRole('listbox', { name: suggestions.label });
  const rowLink = (page: Page, name: string | RegExp) =>
    list(page).getByRole('option', { name });
  const spinner = (page: Page) =>
    page
      .getByRole('banner')
      .getByRole('status', { name: messages.header.search.loading });

  /** Opens `path` with auth and suggestions mocked, once the header is up. */
  async function open(page: Page, path: string, hits?: Hit[]) {
    await mockAuthApi(page);
    const calls = await mockSuggestions(page, hits);
    await page.goto(path);
    await expect(
      page
        .getByRole('banner')
        .getByRole('link', { name: messages.header.account.signIn }),
    ).toBeVisible();
    return { calls, home: page.url() };
  }

  /** Types `query`, waits for the list, then leaves the field. */
  async function typeThenBlur(page: Page, query: string) {
    await header(page).fill(query);
    await expect(list(page)).toBeVisible();
    await header(page).blur();
    await expect(list(page)).toHaveCount(0);
  }

  test.describe(`header suggestions (${locale})`, () => {
    test('lists the Recordings in the order the catalog ranks them', async ({
      page,
    }) => {
      const { home } = await open(page, `/${locale}`);

      await header(page).fill('queen');
      const rows = list(page).getByRole('option');
      await expect(rows).toHaveCount(RANKED.length + 1);
      for (const [index, hit] of RANKED.entries()) {
        await expect(rows.nth(index)).toContainText(hit.title);
        await expect(rows.nth(index)).toContainText(hit.artist);
      }
      await expect(rows.last()).toContainText(searchForLabel('queen'));
      await expect(page).toHaveURL(home);
    });

    test('asks for six suggestions and shows at most six Recordings', async ({
      page,
    }) => {
      const { calls } = await open(page, `/${locale}`);

      await header(page).fill('queen');
      await expect(rowLink(page, /Radio Ga Ga/)).toBeVisible();
      expect(searchParamsOf(lastOf(calls))).toMatchObject({
        query: 'queen',
        scope: 'metadata',
        limit: '6',
      });
      // Six Recordings plus the Search-for row, never a seventh hit.
      await expect(list(page).getByRole('option')).toHaveCount(7);
    });

    test('shows the cover art, or the placeholder, at the design size', async ({
      page,
    }) => {
      await page.route('**/_next/image**', (route) =>
        route.fulfill({ contentType: 'image/png', body: PNG }),
      );
      await open(page, `/${locale}`);

      await header(page).fill('queen');
      const rows = list(page).getByRole('option');
      const art = rows.nth(0).locator('img');
      await expect(art).toHaveCount(1);
      await expect(art).toHaveJSProperty('naturalWidth', 1);
      await expect(rows.nth(1).locator('img')).toHaveCount(0);

      // 48px covers, rows at least 56px tall, the 150ms colour transition.
      const cover = await art.boundingBox();
      expect(cover?.width).toBe(48);
      expect(cover?.height).toBe(48);
      for (let index = 0; index < RANKED.length; index += 1) {
        const row = await rows.nth(index).boundingBox();
        expect(row?.height ?? 0).toBeGreaterThanOrEqual(56);
      }
      await expect(rowLink(page, /Radio Ga Ga/)).toHaveCSS(
        'transition-duration',
        '0.15s',
      );
    });

    test('a suggestion with a Track opens its Track page and clears the field', async ({
      page,
    }) => {
      await registerTrack('seedtrack02');
      await open(page, `/${locale}`);

      await header(page).fill('bohemian');
      await rowLink(page, /Radio Ga Ga/).click();
      await expect(page).toHaveURL(/\/tracks\/seedtrack02/);
      // The field lets go of the query, so the next page does not reopen it.
      await expect(header(page)).toHaveValue('');
      await header(page).focus();
      await expect(list(page)).toHaveCount(0);
    });

    test('the Search-for row goes to the full search with the query normalized', async ({
      page,
    }) => {
      await open(page, `/${locale}`);

      await header(page).fill('  under   pressure ');
      await rowLink(page, searchForLabel('under pressure')).click();
      await expect(page).toHaveURL(`/${locale}/search?q=under+pressure`);
      await expect(header(page)).toHaveValue('under pressure');
    });

    test('the Search-for row stays for an empty match', async ({ page }) => {
      await open(page, `/${locale}`, []);

      await header(page).fill('xyzabc');
      await expect(list(page).getByText(suggestions.noSongs)).toBeVisible();
      await expect(rowLink(page, searchForLabel('xyzabc'))).toBeVisible();
    });

    test('the list stays off on the search page', async ({ page }) => {
      await mockAuthApi(page);
      await mockSuggestions(page);
      await page.goto(`/${locale}/search`);

      await header(page).fill('queen');
      await expect(page).toHaveURL(/q=queen/);
      await expect(list(page)).toHaveCount(0);
    });

    test('blurring closes the list without navigating', async ({ page }) => {
      const { home } = await open(page, `/${locale}`);

      await typeThenBlur(page, 'queen');
      await expect(page).toHaveURL(home);
    });

    test('a click outside closes the list without navigating', async ({
      page,
    }) => {
      const { home } = await open(page, `/${locale}`);

      await header(page).fill('queen');
      await expect(list(page)).toBeVisible();
      await page.mouse.click(5, 600);
      await expect(list(page)).toHaveCount(0);
      await expect(page).toHaveURL(home);
    });

    test('clicking the field with text reopens the cached suggestions', async ({
      page,
    }) => {
      const { calls } = await open(page, `/${locale}`);

      await typeThenBlur(page, 'queen');
      const requests = calls.length;
      await header(page).click();
      await expect(list(page).getByRole('option').first()).toBeVisible();
      expect(calls).toHaveLength(requests);
    });

    test('the hotkey reopens the cached suggestions', async ({ page }) => {
      const { calls } = await open(page, `/${locale}`);

      await typeThenBlur(page, 'queen');
      const requests = calls.length;
      await page.keyboard.press('Control+k');
      await expect(header(page)).toBeFocused();
      await expect(list(page).getByRole('option').first()).toBeVisible();
      expect(calls).toHaveLength(requests);
    });

    test('the spinner shows from the first keystroke, not only during the fetch', async ({
      page,
    }) => {
      await open(page, `/${locale}`);

      await header(page).press('q');
      // Well before the debounce ends and the fetch runs: the field spins.
      await expect(spinner(page)).toBeVisible({ timeout: 150 });
      await expect(spinner(page)).toHaveCount(0);
    });

    test('a blank field never spins', async ({ page }) => {
      await open(page, `/${locale}`);

      await header(page).fill('queen');
      await expect(spinner(page)).toHaveCount(0);
      await header(page).fill('');
      await expect(spinner(page)).toHaveCount(0);
    });
  });

  test.describe(`header suggestions on touch (${locale})`, () => {
    test.use({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });

    /** On a phone the field opens from the search button, then takes text. */
    async function openOnPhone(page: Page): Promise<Locator> {
      await open(page, `/${locale}`);
      await page
        .getByRole('banner')
        .getByRole('button', { name: messages.header.search.open })
        .tap();
      await expect(header(page)).toBeFocused();
      return header(page);
    }

    test('tapping a Recording opens its Track page', async ({ page }) => {
      await registerTrack('seedtrack02');
      const field = await openOnPhone(page);

      await field.fill('queen');
      await rowLink(page, /Radio Ga Ga/).tap();
      await expect(page).toHaveURL(/\/tracks\/seedtrack02/);
    });

    test('tapping the Search-for row goes to the full search', async ({
      page,
    }) => {
      const field = await openOnPhone(page);

      await field.fill('queen');
      await rowLink(page, searchForLabel('queen')).tap();
      await expect(page).toHaveURL(`/${locale}/search?q=queen`);
    });

    /** Opens the phone field and types a query that shows the list. */
    async function typedOnPhone(page: Page) {
      const field = await openOnPhone(page);
      const home = page.url();
      await field.fill('queen');
      await expect(list(page)).toBeVisible();
      return { field, home };
    }

    test('the first Escape closes the list and the second collapses the field', async ({
      page,
    }) => {
      const { field, home } = await typedOnPhone(page);

      await field.press('Escape');
      await expect(list(page)).toHaveCount(0);
      await expect(field).toBeFocused();
      await expect(field).toHaveValue('queen');
      await field.press('Escape');
      await expect(field).toBeHidden();
      await expect(page).toHaveURL(home);
    });

    test('Cancel collapses the field and closes the list without navigating', async ({
      page,
    }) => {
      const { field, home } = await typedOnPhone(page);

      await page
        .getByRole('banner')
        .getByRole('button', { name: messages.header.search.cancel })
        .tap();
      await expect(field).toBeHidden();
      await expect(list(page)).toHaveCount(0);
      await expect(page).toHaveURL(home);
    });

    test('arrows and Enter open the highlighted Track on a phone', async ({
      page,
    }) => {
      await registerTrack('seedtrack02');
      const { field } = await typedOnPhone(page);

      await field.press('ArrowDown');
      await field.press('ArrowDown');
      await expect(list(page).locator('[data-highlighted]')).toContainText(
        'Radio Ga Ga',
      );
      await field.press('Enter');
      await expect(page).toHaveURL(/\/tracks\/seedtrack02/);
    });

    test('Enter with nothing highlighted goes to the full search on a phone', async ({
      page,
    }) => {
      const { field } = await typedOnPhone(page);

      await field.press('Enter');
      await expect(page).toHaveURL(`/${locale}/search?q=queen`);
    });

    test('Enter on a blank phone field does nothing', async ({ page }) => {
      const field = await openOnPhone(page);
      const home = page.url();

      await field.press('Enter');
      await expect(page).toHaveURL(home);
      await expect(list(page)).toHaveCount(0);
    });
  });

  test.describe(`header suggestion keyboard (${locale})`, () => {
    /** The one row the keyboard highlights, Search-for row included. */
    const highlightedRow = (page: Page) =>
      list(page).locator('[data-highlighted]');

    test('arrows move the highlight, and Enter opens the highlighted Track', async ({
      page,
    }) => {
      await registerTrack('seedtrack02');
      await open(page, `/${locale}`);

      await header(page).fill('queen');
      await expect(rowLink(page, /Radio Ga Ga/)).toBeVisible();
      await header(page).press('ArrowDown');
      await header(page).press('ArrowDown');
      await expect(highlightedRow(page)).toContainText('Radio Ga Ga');
      await header(page).press('Enter');
      await expect(page).toHaveURL(/\/tracks\/seedtrack02/);
    });

    test('ArrowUp from nothing highlights the Search-for row, and ArrowDown wraps back to the first row', async ({
      page,
    }) => {
      await open(page, `/${locale}`);

      await header(page).fill('queen');
      await expect(rowLink(page, /Radio Ga Ga/)).toBeVisible();
      await header(page).press('ArrowUp');
      await expect(highlightedRow(page)).toContainText(searchForLabel('queen'));
      await header(page).press('ArrowDown');
      await expect(highlightedRow(page)).toContainText('Under Pressure');
    });

    test('Enter on the highlighted Search-for row goes to the full search', async ({
      page,
    }) => {
      await open(page, `/${locale}`);

      await header(page).fill('queen');
      await header(page).press('ArrowUp');
      await header(page).press('Enter');
      await expect(page).toHaveURL(`/${locale}/search?q=queen`);
    });

    test('Enter with nothing highlighted goes to the full search', async ({
      page,
    }) => {
      await open(page, `/${locale}`);

      await header(page).fill('  queen ');
      await header(page).press('Enter');
      await expect(page).toHaveURL(`/${locale}/search?q=queen`);
      await expect(header(page)).toHaveValue('queen');
    });

    test('Enter on a blank field does nothing', async ({ page }) => {
      const { home } = await open(page, `/${locale}`);

      await header(page).focus();
      await header(page).press('Enter');
      await expect(page).toHaveURL(home);
      await expect(list(page)).toHaveCount(0);
    });

    test('the first Escape closes the list, keeps the focus and the text', async ({
      page,
    }) => {
      const { home } = await open(page, `/${locale}`);

      await header(page).fill('queen');
      await header(page).press('ArrowDown');
      await expect(highlightedRow(page)).toHaveCount(1);
      await header(page).press('Escape');
      await expect(list(page)).toHaveCount(0);
      await expect(header(page)).toBeFocused();
      await expect(header(page)).toHaveValue('queen');
      await expect(page).toHaveURL(home);
    });

    test('the arrows do nothing on a closed list', async ({ page }) => {
      const { home } = await open(page, `/${locale}`);

      await header(page).focus();
      await header(page).press('ArrowDown');
      await header(page).press('ArrowUp');
      await expect(list(page)).toHaveCount(0);
      await expect(header(page)).toBeFocused();
      await expect(header(page)).toHaveValue('');
      await expect(page).toHaveURL(home);
    });

    // Contract until #251: a highlighted Recording without a Track is a plain
    // option, and Enter clicks it like any row. It has no press handler yet,
    // so Enter closes the list and nothing else happens. #251 gives these rows
    // the request and sign-in flow on the same click, and changes this test.
    test('Enter on a highlighted Recording without a Track closes the list', async ({
      page,
    }) => {
      const { home } = await open(page, `/${locale}`);

      await header(page).fill('queen');
      await header(page).press('ArrowDown');
      await expect(highlightedRow(page)).toContainText('Under Pressure');
      await header(page).press('Enter');
      await expect(list(page)).toHaveCount(0);
      await expect(page).toHaveURL(home);
    });

    test('the field is a combobox that names its listbox and the highlighted option', async ({
      page,
    }) => {
      await open(page, `/${locale}`);
      const field = header(page);

      await expect(field).toHaveAttribute('aria-expanded', 'false');
      await expect(field).not.toHaveAttribute('aria-controls');
      await field.fill('queen');
      await expect(list(page)).toBeVisible();
      await expect(field).toHaveAttribute('aria-expanded', 'true');
      await expect(field).toHaveAttribute(
        'aria-controls',
        'header-suggestions-listbox',
      );
      await expect(list(page)).toHaveAttribute(
        'id',
        'header-suggestions-listbox',
      );

      await field.press('ArrowDown');
      await field.press('ArrowDown');
      const radio = rowLink(page, /Radio Ga Ga/);
      await expect(radio).toHaveAttribute('aria-selected', 'true');
      await expect(rowLink(page, /Under Pressure/)).toHaveAttribute(
        'aria-selected',
        'false',
      );
      await expect(field).toHaveAttribute(
        'aria-activedescendant',
        (await radio.getAttribute('id')) ?? '',
      );

      await field.press('Escape');
      await expect(field).toHaveAttribute('aria-expanded', 'false');
      await expect(field).not.toHaveAttribute('aria-activedescendant');
    });
  });
}

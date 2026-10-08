import { expect, type Page, test } from '@playwright/test';

import { ADA, mockAuthApi } from './auth-api-mock';
import { type FakeTrack, setTrackMock } from './fake-track-api';
import { messages as catalogs } from './messages';
import { mockSearchApi } from './search-api-mock';

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;

/** The second search hit of the search mock: a Recording without a Track. */
const UNLINKED_MBID = '00000000-0000-4000-8000-000000000002';
const UNLINKED_TITLE = 'Unreleased Demo';

/** A signed-in User with a username: the one who can ask for notes. */
const SINGER = { ...ADA, username: 'ada_singer' };

/** A Track in the fake API, in the state a test needs. */
const trackFixture = (
  id: string,
  overrides: Partial<FakeTrack> = {},
): FakeTrack => ({
  id,
  title: UNLINKED_TITLE,
  artistCredit: [],
  processing: { status: 'QUEUED' },
  contributors: [
    {
      id: `contributor-${id}`,
      username: 'ada_singer',
      name: 'Ada Lovelace',
      image: null,
    },
  ],
  ...overrides,
});

// The request flow shares one Recording MBID in the fake API. Its answers are
// keyed by locale, and each locale's tests run in order.
for (const { locale, messages } of cases) {
  const generateName = messages.tracks.card.generateLabel.replace(
    '{title}',
    UNLINKED_TITLE,
  );
  const progress = (page: Page) => page.getByRole('progressbar');

  test.describe(`track processing (${locale})`, () => {
    test.describe.configure({ mode: 'serial' });

    test('a signed-in search result without a Track asks for its notes and opens the Processing page', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: SINGER });
      await mockSearchApi(page);
      const trackId = `clx-flow-${locale}`;
      await setTrackMock({
        tracks: [trackFixture(trackId)],
        requests: {
          [`${UNLINKED_MBID}:${locale}`]: { trackId, created: true },
        },
      });
      await page.goto(`/${locale}/search?q=queen`);

      await page.getByRole('button', { name: generateName }).click();

      await expect(page).toHaveURL(`/${locale}/tracks/${trackId}`);
      await expect(
        page.getByRole('heading', { level: 1, name: UNLINKED_TITLE }),
      ).toBeVisible();
      await expect(progress(page)).toHaveAttribute('aria-valuenow', '0');
      await expect(
        page.getByRole('list', {
          name: messages.tracks.processing.steps.label,
        }),
      ).toBeVisible();
    });

    test('follows the Processing as it moves through its steps, without a reload', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: SINGER });
      const trackId = `clx-poll-${locale}`;
      await setTrackMock({
        tracks: [
          trackFixture(trackId, {
            processing: { status: 'DOWNLOADING_AUDIO' },
          }),
        ],
      });
      await page.goto(`/${locale}/tracks/${trackId}`);
      await expect(progress(page)).toHaveAttribute('aria-valuenow', '30');

      // The pipeline moves on; the open page catches up by polling.
      await setTrackMock({
        tracks: [
          trackFixture(trackId, {
            processing: { status: 'EXTRACTING_VOCALS' },
          }),
        ],
      });

      await expect(progress(page)).toHaveAttribute('aria-valuenow', '50');
      await expect(page.locator('li[data-state="current"]')).toContainText(
        messages.tracks.processing.steps.EXTRACTING_VOCALS,
      );
    });

    test('says the page can be closed while it runs, then shows the notes once they are ready', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: SINGER });
      const trackId = `clx-done-${locale}`;
      await setTrackMock({
        tracks: [
          trackFixture(trackId, { processing: { status: 'DETECTING_NOTES' } }),
        ],
      });
      await page.goto(`/${locale}/tracks/${trackId}`);
      await expect(
        page.getByText(messages.tracks.processing.closeNote),
      ).toBeVisible();

      await setTrackMock({
        tracks: [
          trackFixture(trackId, { processing: { status: 'COMPLETED' } }),
        ],
      });

      await expect(progress(page)).toHaveAttribute('aria-valuenow', '100');
      await expect(
        page.getByRole('heading', {
          name: messages.tracks.processing.completed.title,
        }),
      ).toBeVisible();
      await expect(
        page.getByText(messages.tracks.processing.closeNote),
      ).toHaveCount(0);
    });

    test('shows the artist credit in the header while the Processing has not started', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: SINGER });
      const trackId = `clx-credit-${locale}`;
      await setTrackMock({
        tracks: [
          trackFixture(trackId, {
            artistCredit: [
              { name: 'Queen', joinPhrase: ' feat. ' },
              { name: 'David Bowie', joinPhrase: '' },
            ],
          }),
        ],
      });

      await page.goto(`/${locale}/tracks/${trackId}`);

      await expect(
        page.getByText('Queen feat. David Bowie', { exact: true }),
      ).toBeVisible();
      await expect(progress(page)).toHaveAttribute('aria-valuenow', '0');
    });

    test('shows the translated reason of a failed Processing', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: SINGER });
      const trackId = `clx-failed-${locale}`;
      await setTrackMock({
        tracks: [
          trackFixture(trackId, {
            processing: {
              status: 'FAILED',
              failureCode: 'DOWNLOAD_FAILED',
              resumeFrom: 'DOWNLOADING_AUDIO',
              retryable: true,
            },
          }),
        ],
      });

      await page.goto(`/${locale}/tracks/${trackId}`);

      await expect(
        page.getByRole('heading', {
          name: messages.tracks.processing.failed.title,
        }),
      ).toBeVisible();
      await expect(
        page.getByText(
          messages.tracks.processing.failed.reason.DOWNLOAD_FAILED,
        ),
      ).toBeVisible();
      await expect(progress(page)).toHaveAttribute('aria-valuenow', '30');
    });

    test('lists the Contributors with their name, linking to their Profile', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: SINGER });
      const trackId = `clx-contributors-${locale}`;
      await setTrackMock({ tracks: [trackFixture(trackId)] });

      await page.goto(`/${locale}/tracks/${trackId}`);

      await expect(
        page.getByRole('link', { name: 'Ada Lovelace' }),
      ).toHaveAttribute('href', `/${locale}/users/ada_singer`);
    });

    test('shows a visitor who is signed out the search result as a static card', async ({
      page,
    }) => {
      await mockAuthApi(page);
      await mockSearchApi(page);
      await page.goto(`/${locale}/search?q=queen`);

      await expect(
        page.getByRole('main').getByText(UNLINKED_TITLE),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: generateName }),
      ).toHaveCount(0);
    });

    test('shows a translated toast and stays on the search when the request fails', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: SINGER });
      await mockSearchApi(page);
      await setTrackMock({
        requests: {
          [`${UNLINKED_MBID}:${locale}`]: {
            status: 503,
            code: 'SERVICE_UNAVAILABLE',
          },
        },
      });
      await page.goto(`/${locale}/search?q=queen`);

      await page.getByRole('button', { name: generateName }).click();

      await expect(
        page.getByText(messages.errors.SERVICE_UNAVAILABLE),
      ).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/${locale}/search\\?q=queen$`));
    });

    test('legacy ID redirects with 308 keeping the query', async ({
      page,
      request,
      baseURL,
    }) => {
      await mockAuthApi(page, { user: SINGER });
      const newId = `clx-308-new-${locale}`;
      const legacyId = `legacy-track-308-${locale}`;
      await setTrackMock({
        tracks: [trackFixture(newId)],
        legacyMap: { [legacyId]: newId },
      });

      // A real permanent redirect, not a client-side hop.
      const raw = await request.get(`/${locale}/tracks/${legacyId}?x=1`, {
        maxRedirects: 0,
      });
      expect(raw.status()).toBe(308);
      const url = new URL(raw.headers().location ?? '', baseURL);
      expect(url.pathname).toBe(`/${locale}/tracks/${newId}`);
      expect(url.searchParams.get('x')).toBe('1');

      await page.goto(`/${locale}/tracks/${legacyId}?x=1`);

      await expect(page).toHaveURL(`/${locale}/tracks/${newId}?x=1`);
      await expect(
        page.getByRole('heading', { level: 1, name: UNLINKED_TITLE }),
      ).toBeVisible();
    });

    test('unknown ID is a real 404', async ({ page }) => {
      await mockAuthApi(page);

      const response = await page.goto(
        `/${locale}/tracks/does-not-exist-${locale}`,
      );

      expect(response?.status()).toBe(404);
    });
  });
}

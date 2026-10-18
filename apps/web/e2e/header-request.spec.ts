import { expect, type Page, type Route, test } from '@playwright/test';

import { ADA, type MockUser, mockAuthApi } from './auth-api-mock';
import { type FakeTrack, setTrackMock } from './fake-track-api';
import { messages as catalogs } from './messages';
import { countTrackRequests, signInOverrides } from './request-track-mocks';
import { mockSearchApi } from './search-api-mock';

const localeCatalogs = (['en', 'pt-BR'] as const).map((locale) => ({
  locale,
  messages: catalogs[locale],
}));

/** A signed-in User with a username: the one who can ask for notes. */
const SINGER: MockUser = { ...ADA, username: 'ada_singer' };

/**
 * The fourth hit of the search mock: a Recording without a Track. Its MBID is
 * the one this spec's Track request answers (keyed by MBID and locale, so the
 * other specs' requests stay apart).
 */
const UNLINKED_MBID = '00000000-0000-4000-8000-000000000004';
const UNLINKED_TITLE = 'Song 4';
const QUERY = 'song';

/** The suggestions of the header for `QUERY`: four hits, the fourth unlinked. */
const HITS = { totalCount: 4 };

const trackFixture = (id: string): FakeTrack => ({
  id,
  title: UNLINKED_TITLE,
  artistCredit: [],
  processing: { status: 'QUEUED' },
  contributors: [],
});

/**
 * Holds the `POST /v1/tracks` until the returned `release` runs, so the
 * request's feedback can be seen while it is on its way.
 */
async function holdTrackRequest(page: Page): Promise<() => void> {
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/v1/tracks', async (route: Route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await released;
    return route.fallback();
  });
  return release;
}

for (const { locale, messages } of localeCatalogs) {
  const suggestions = messages.header.search.suggestions;
  const header = (page: Page) =>
    page
      .getByRole('banner')
      .getByRole('searchbox', { name: messages.header.search.label });
  const list = (page: Page) =>
    page.getByRole('group', { name: suggestions.label });
  const generateButton = (page: Page) =>
    list(page).getByRole('button', {
      name: suggestions.generateLabel.replace('{title}', UNLINKED_TITLE),
    });
  const signInLink = (page: Page) =>
    list(page).getByRole('link', {
      name: suggestions.signInLabel.replace('{title}', UNLINKED_TITLE),
    });
  const unlinkedRow = (page: Page) =>
    list(page).getByRole('listitem').filter({ hasText: UNLINKED_TITLE });
  const requestKey = `${UNLINKED_MBID}:${locale}`;
  // Both request tests answer with this one Track: the fake API keeps one answer
  // per MBID and locale, and the tests run in parallel.
  const trackId = `clx-header-track-${locale}`;

  /** Opens the home page, signed in as `user` (or signed out), with the search mocked. */
  async function open(page: Page, user: MockUser | null) {
    await mockAuthApi(page, { user });
    await mockSearchApi(page, HITS);
    await page.goto(`/${locale}`);
    await expect(header(page)).toBeVisible();
  }

  test.describe(`header request for a Recording without a Track (${locale})`, () => {
    test('a signed-out visitor sees the no-notes marker and a sign-in link', async ({
      page,
    }) => {
      await open(page, null);

      await header(page).fill(QUERY);
      await expect(unlinkedRow(page)).toContainText(suggestions.noNotesYet);
      await expect(signInLink(page)).toBeVisible();
      await expect(generateButton(page)).toHaveCount(0);
    });

    test('a signed-out click signs in, then returns to the search and requests the Track once', async ({
      page,
    }) => {
      await mockAuthApi(page, { overrides: signInOverrides(SINGER) });
      await mockSearchApi(page, HITS);
      await setTrackMock({
        tracks: [trackFixture(trackId)],
        requests: { [requestKey]: { trackId, created: true } },
      });
      const requestsMade = countTrackRequests(page);
      await page.goto(`/${locale}`);

      await header(page).fill(QUERY);
      await signInLink(page).click();

      // The sign-in page returns to the search this query came from, with the marker.
      await expect(page).toHaveURL(
        `/${locale}/sign-in?redirectTo=${encodeURIComponent(
          `/search?q=${QUERY}&process=${UNLINKED_MBID}`,
        )}`,
      );
      await page
        .getByLabel(messages.auth.signIn.emailOrUsername.label)
        .fill(SINGER.email);
      await page
        .getByLabel(messages.auth.fields.password.label, { exact: true })
        .fill('analytical-1843');
      await page
        .getByRole('button', { name: messages.auth.signIn.submit })
        .click();

      await expect(page).toHaveURL(`/${locale}/tracks/${trackId}`);
      expect(requestsMade()).toBe(1);
    });

    test('a signed-in visitor asks for the notes from the list, with the request feedback', async ({
      page,
    }) => {
      await open(page, SINGER);
      await setTrackMock({
        tracks: [trackFixture(trackId)],
        requests: { [requestKey]: { trackId, created: true } },
      });
      const requestsMade = countTrackRequests(page);
      const release = await holdTrackRequest(page);

      await header(page).fill(QUERY);
      await generateButton(page).click();

      // While the request is on its way the row spins, and it cannot be pressed again.
      await expect(generateButton(page)).toBeDisabled();
      await expect(unlinkedRow(page)).toContainText(suggestions.generating);
      release();

      await expect(page).toHaveURL(`/${locale}/tracks/${trackId}`);
      expect(requestsMade()).toBe(1);
    });
  });
}

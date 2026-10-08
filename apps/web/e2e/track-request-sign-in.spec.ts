import { expect, type Page, test } from '@playwright/test';

import { ADA, type MockUser, mockAuthApi } from './auth-api-mock';
import { type FakeTrack, setTrackMock } from './fake-track-api';
import { messages as catalogs } from './messages';
import { mockSearchApi } from './search-api-mock';

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;

// The search mock names its hits by position, and the fake API shares its
// answers across every spec. So these specs use the third hit, a Recording of
// its own (its MBID answers only here), and the second hit has a Track.
const SEARCH = {
  totalCount: 3,
  unlinked: {
    title: 'Unreleased Demo',
    artist: 'Unknown Artist',
    trackId: 'clxlinkeddemo01',
  },
};
const UNLINKED_MBID = '00000000-0000-4000-8000-000000000003';
const UNLINKED_TITLE = 'Song 3';

/** A signed-in User with a username: the one who can ask for notes. */
const SINGER: MockUser = { ...ADA, username: 'ada_singer' };

const trackFixture = (id: string): FakeTrack => ({
  id,
  title: UNLINKED_TITLE,
  artistCredit: [],
  processing: { status: 'QUEUED' },
  contributors: [],
});

/**
 * The sign-in endpoints of the mock. Signing in makes `user` the session's
 * user, as the API does, so the search page the round trip returns to sees it.
 */
function signInOverrides(user: MockUser) {
  let signedIn = false;
  return {
    '/sign-in/email': () => {
      signedIn = true;
      return { body: { redirect: false, token: 'token', user } };
    },
    '/get-session': () => ({
      body: signedIn ? { session: { id: 'ses_1' }, user } : null,
    }),
  };
}

/** Counts the `POST /v1/tracks` requests the page sends. */
function countTrackRequests(page: Page): () => number {
  let count = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/v1/tracks'
    ) {
      count += 1;
    }
  });
  return () => count;
}

for (const { locale, messages } of cases) {
  const generateName = messages.tracks.card.generateLabel.replace(
    '{title}',
    UNLINKED_TITLE,
  );

  test.describe(`request a Track after signing in (${locale})`, () => {
    // Each test sets the answer its request gets, so they run in order.
    test.describe.configure({ mode: 'serial' });

    test('a signed-out click on a result without a Track signs in, then requests it once', async ({
      page,
    }) => {
      await mockAuthApi(page, { overrides: signInOverrides(SINGER) });
      await mockSearchApi(page, SEARCH);
      const trackId = `clx-signin-${locale}`;
      await setTrackMock({
        tracks: [trackFixture(trackId)],
        requests: {
          [`${UNLINKED_MBID}:${locale}`]: { trackId, created: true },
        },
      });
      const requestsMade = countTrackRequests(page);
      await page.goto(`/${locale}/search?q=queen`);

      await page
        .getByRole('link', { name: messages.tracks.card.signInToGenerate })
        .click();

      // The sign-in page returns to this search, with the request marker.
      await expect(page).toHaveURL(
        `/${locale}/sign-in?redirectTo=${encodeURIComponent(
          `/search?q=queen&process=${UNLINKED_MBID}`,
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

      // The marker left the search's history entry, so going back, or
      // reloading it, does not request the Track again.
      await page.goBack();
      await expect(page).toHaveURL(`/${locale}/search?q=queen`);
      await page.reload();
      await expect(
        page.getByRole('main').getByText(UNLINKED_TITLE, { exact: true }),
      ).toBeVisible();
      expect(requestsMade()).toBe(1);
    });

    test('a signed-in visitor who arrives with the request marker gets the Track once, with no marker left', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: SINGER });
      await mockSearchApi(page, SEARCH);
      const trackId = `clx-arrive-${locale}`;
      await setTrackMock({
        tracks: [trackFixture(trackId)],
        requests: {
          [`${UNLINKED_MBID}:${locale}`]: { trackId, created: true },
        },
      });
      const requestsMade = countTrackRequests(page);

      await page.goto(`/${locale}/search?q=queen&process=${UNLINKED_MBID}`);

      await expect(page).toHaveURL(`/${locale}/tracks/${trackId}`);
      expect(requestsMade()).toBe(1);
      await page.goBack();
      await expect(page).toHaveURL(`/${locale}/search?q=queen`);
      expect(requestsMade()).toBe(1);
    });

    for (const [limit, max] of [
      ['ACTIVE_PROCESSINGS', 3],
      ['NEW_TRACKS_PER_DAY', 20],
    ] as const) {
      test(`shows the translated toast of the ${limit} limit and stays on the search`, async ({
        page,
      }) => {
        await mockAuthApi(page, { user: SINGER });
        await mockSearchApi(page, SEARCH);
        await setTrackMock({
          requests: {
            [`${UNLINKED_MBID}:${locale}`]: {
              status: 429,
              code: 'PROCESSING_LIMIT_REACHED',
              details: { limit, max },
            },
          },
        });
        await page.goto(`/${locale}/search?q=queen`);

        await page.getByRole('button', { name: generateName }).click();

        await expect(
          page.getByText(
            messages.errors.processingLimit[limit].replace(
              '{max}',
              String(max),
            ),
          ),
        ).toBeVisible();
        await expect(page).toHaveURL(
          new RegExp(`/${locale}/search\\?q=queen$`),
        );
      });
    }
  });
}

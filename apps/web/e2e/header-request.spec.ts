import {
  expect,
  type Locator,
  type Page,
  type Route,
  test,
} from '@playwright/test';

import { ADA, type MockUser, mockAuthApi } from './auth-api-mock';
import { type FakeTrack, setTrackMock } from './fake-track-api';
import { messages as catalogs } from './messages';
import { countTrackRequests, signInOverrides } from './request-track-mocks';
import { corsHeaders, mockSearchApi } from './search-api-mock';

const localeCatalogs = (['en', 'pt-BR'] as const).map((locale) => ({
  locale,
  messages: catalogs[locale],
}));

/** A signed-in User with a username: the one who can ask for notes. */
const SINGER: MockUser = { ...ADA, username: 'ada_singer' };

/** What `mockAuthApi` takes: who is signed in, and any endpoint overrides. */
type AuthOptions = Parameters<typeof mockAuthApi>[1];

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

/**
 * Answers the browser's `POST /v1/tracks` with a processing limit. The
 * request never reaches the fake API, so its per-MBID answers stay untouched.
 */
async function refuseTrackRequests(page: Page) {
  await page.route('**/v1/tracks', async (route: Route) => {
    const request = route.request();
    const headers = corsHeaders(request);
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (request.method() !== 'POST') return route.fallback();
    await route.fulfill({
      status: 429,
      headers,
      body: JSON.stringify({
        statusCode: 429,
        code: 'PROCESSING_LIMIT_REACHED',
        message: 'Limit reached',
        details: { limit: 'ACTIVE_PROCESSINGS', max: 3 },
      }),
    });
  });
}

for (const { locale, messages } of localeCatalogs) {
  const suggestions = messages.header.search.suggestions;
  const header = (page: Page) =>
    page
      .getByRole('banner')
      .getByRole('combobox', { name: messages.header.search.label });
  const list = (page: Page) =>
    page.getByRole('listbox', { name: suggestions.label });
  // The rows are options of the listbox; the request row is a button that
  // carries the option role, the sign-in row a link carrying it.
  // `exact`: the sign-in row's name contains the request row's ("Sign in to
  // generate notes for …"), so a substring match would find both.
  const generateButton = (page: Page) =>
    list(page).getByRole('option', {
      name: suggestions.generateLabel.replace('{title}', UNLINKED_TITLE),
      exact: true,
    });
  const signInLink = (page: Page) =>
    list(page).getByRole('option', {
      name: suggestions.signInLabel.replace('{title}', UNLINKED_TITLE),
      exact: true,
    });
  const unlinkedRow = (page: Page) =>
    list(page).getByRole('option').filter({ hasText: UNLINKED_TITLE });
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
      // Before the click the row carries the marker, as the signed-out row does.
      await expect(unlinkedRow(page)).toContainText(suggestions.noNotesYet);
      await generateButton(page).click();

      // While the request is on its way the row spins, and it cannot be pressed again.
      await expect(generateButton(page)).toBeDisabled();
      await expect(unlinkedRow(page)).toContainText(suggestions.generating);
      release();

      await expect(page).toHaveURL(`/${locale}/tracks/${trackId}`);
      expect(requestsMade()).toBe(1);
    });

    test('a failed request shows the translated error, stays on the page and can be tried again', async ({
      page,
    }) => {
      await open(page, SINGER);
      await refuseTrackRequests(page);
      const requestsMade = countTrackRequests(page);

      await header(page).fill(QUERY);
      await generateButton(page).click();

      await expect(
        page.getByText(
          messages.errors.processingLimit.ACTIVE_PROCESSINGS.replace(
            '{max}',
            '3',
          ),
        ),
      ).toBeVisible();
      await expect(page).toHaveURL(`/${locale}`);
      await expect(generateButton(page)).toBeEnabled();
      await expect(unlinkedRow(page)).toContainText(suggestions.noNotesYet);
      expect(requestsMade()).toBe(1);
    });
  });

  /**
   * The keyboard reaches the no-Track rows like the Track rows: the arrows
   * highlight the row, the field points at it, and Enter clicks it. The
   * unlinked row is the fourth of the four hits.
   */
  const KEYS_TO_UNLINKED = 4;

  async function highlightUnlinked(page: Page) {
    for (let press = 0; press < KEYS_TO_UNLINKED; press += 1) {
      await header(page).press('ArrowDown');
    }
    await expect(generateButton(page).or(signInLink(page))).toHaveAttribute(
      'data-highlighted',
    );
  }

  /** The field's `aria-activedescendant` names the given (highlighted) row. */
  async function expectActiveRow(page: Page, row: Locator) {
    const rowId = await row.getAttribute('id');
    expect(rowId).not.toBeNull();
    await expect(header(page)).toHaveAttribute(
      'aria-activedescendant',
      rowId ?? '',
    );
  }

  for (const viewport of ['desktop', 'phone'] as const) {
    test.describe(`header request by keyboard, ${viewport} (${locale})`, () => {
      if (viewport === 'phone') {
        test.use({
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        });
      }

      /** The field is open and focused: on a phone it opens from the search button. */
      async function openField(page: Page, auth: AuthOptions) {
        await mockAuthApi(page, auth);
        await mockSearchApi(page, HITS);
        await page.goto(`/${locale}`);
        if (viewport === 'phone') {
          await page
            .getByRole('banner')
            .getByRole('button', { name: messages.header.search.open })
            .tap();
        } else {
          // The desktop field is not focused on load.
          await header(page).focus();
        }
        await expect(header(page)).toBeFocused();
      }

      test('a signed-in visitor requests the notes of a highlighted row with Enter', async ({
        page,
      }) => {
        await openField(page, { user: SINGER });
        await setTrackMock({
          tracks: [trackFixture(trackId)],
          requests: { [requestKey]: { trackId, created: true } },
        });
        const requestsMade = countTrackRequests(page);

        await header(page).fill(QUERY);
        await expect(generateButton(page)).toBeVisible();
        await highlightUnlinked(page);
        await expectActiveRow(page, generateButton(page));
        await header(page).press('Enter');

        await expect(page).toHaveURL(`/${locale}/tracks/${trackId}`);
        expect(requestsMade()).toBe(1);
      });

      test('a signed-out visitor goes to sign in with Enter on a highlighted row, then returns to request the Track', async ({
        page,
      }) => {
        await openField(page, { overrides: signInOverrides(SINGER) });
        await setTrackMock({
          tracks: [trackFixture(trackId)],
          requests: { [requestKey]: { trackId, created: true } },
        });
        const requestsMade = countTrackRequests(page);

        await header(page).fill(QUERY);
        await expect(signInLink(page)).toBeVisible();
        await highlightUnlinked(page);
        await expectActiveRow(page, signInLink(page));
        await header(page).press('Enter');

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
    });
  }

  test(`a failed header request on a Track page shows its toast once (${locale})`, async ({
    page,
  }) => {
    // The Track page mounts its own Toaster; the header's must not add a second.
    const pageTrackId = `clx-header-toast-${locale}`;
    await mockAuthApi(page, { user: SINGER });
    await mockSearchApi(page, HITS);
    await setTrackMock({ tracks: [trackFixture(pageTrackId)] });
    await refuseTrackRequests(page);
    await page.goto(`/${locale}/tracks/${pageTrackId}`);

    await header(page).fill(QUERY);
    await generateButton(page).click();

    await expect(
      page.getByText(
        messages.errors.processingLimit.ACTIVE_PROCESSINGS.replace(
          '{max}',
          '3',
        ),
      ),
    ).toBeVisible();
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(1);
  });

  test(`the search page shows no header suggestions (${locale})`, async ({
    page,
  }) => {
    await mockAuthApi(page, { user: SINGER });
    await mockSearchApi(page, HITS);
    await page.goto(`/${locale}/search?q=${QUERY}`);

    await header(page).fill(QUERY);
    await expect(page).toHaveURL(new RegExp(`q=${QUERY}$`));
    await expect(list(page)).toHaveCount(0);
  });

  // The toast of a failed header request is a fixed element. It must stay on
  // screen and in the lower half of the viewport, where the toasts sit (below
  // the search bar, above the dock), on every page.
  for (const viewport of ['desktop', 'phone'] as const) {
    test.describe(`header failure toast position, ${viewport} (${locale})`, () => {
      if (viewport === 'phone') {
        test.use({
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        });
      }

      /** A failed request from the header, opened on `path` as a signed-in visitor. */
      async function failHeaderRequest(page: Page, path: string) {
        await mockAuthApi(page, { user: SINGER });
        await mockSearchApi(page, HITS);
        await setTrackMock({
          tracks: [trackFixture(`clx-header-pos-${locale}`)],
        });
        await refuseTrackRequests(page);
        await page.goto(`/${locale}${path}`);
        if (viewport === 'phone') {
          await page
            .getByRole('banner')
            .getByRole('button', { name: messages.header.search.open })
            .tap();
        } else {
          await header(page).focus();
        }
        await header(page).fill(QUERY);
        await generateButton(page).click();
      }

      /** Waits until the one toast settles inside the lower half of the viewport. */
      async function expectToastLowerHalf(page: Page) {
        const toast = page.locator('[data-sonner-toast]');
        await expect(toast).toHaveCount(1);
        const size = page.viewportSize();
        if (!size) throw new Error('the page has no viewport');
        await expect
          .poll(async () => inLowerHalf(await toast.boundingBox(), size.height))
          .toBe(true);
      }

      test('on a Track page the toast is inside the viewport, in its lower half', async ({
        page,
      }) => {
        await failHeaderRequest(page, `/tracks/clx-header-pos-${locale}`);
        await expectToastLowerHalf(page);
      });

      test('on the home page the toast is inside the viewport, in its lower half', async ({
        page,
      }) => {
        await failHeaderRequest(page, '');
        await expectToastLowerHalf(page);
      });
    });
  }
}

/**
 * Whether a box lies fully inside a viewport of `height` and its centre sits
 * in the lower half. A toast above the top edge (or under the header) fails.
 */
function inLowerHalf(
  box: { y: number; height: number } | null,
  height: number,
): boolean {
  if (!box) return false;
  return (
    box.y >= 0 &&
    box.y + box.height <= height &&
    box.y + box.height / 2 > height / 2
  );
}

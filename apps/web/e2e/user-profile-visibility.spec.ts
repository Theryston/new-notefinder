import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test';
import type { ProfileVisibility } from '@vozzify/contracts';

import { ADA, mockAuthApi } from './auth-api-mock';
import {
  OWNER_COOKIE,
  setProfileVisibilityMock,
} from './fake-user-visibility.ts';
import { mockProfileVisibilityApi } from './profile-visibility-api-mock';
import { webServerEnv } from './web-server-env';

// The owner of visibility_owner's Profile hid the favorite songs. Visitors never
// see the section; the owner sees it dimmed with a toggle that saves at once.
const OWNER = 'visibility_owner';
const PROFILE_PATH = '/en/users/visibility_owner';
// The cache tags of the Profile's banner and favorite songs (`cacheTags`).
const CACHE_TAGS = [`user-profile:${OWNER}`, `user-favorites:${OWNER}`];
const SHOWN_EXCEPT_FAVORITES: ProfileVisibility = {
  summary: true,
  practiceHistory: true,
  favorites: false,
};
const HIDE_LABEL = 'Only you can see this';
const SHOW_LABEL = 'Visible to everyone';

const ownerCookie = {
  name: OWNER_COOKIE,
  value: OWNER,
  domain: 'localhost',
  path: '/',
};

const favorites = (page: import('@playwright/test').Page) =>
  page.locator('[data-section="favorites"]');

test.describe('public profile section visibility', () => {
  // The fake API keeps one visibility state for every spec, so these run
  // one after another, each on a Profile of its own.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ request }) => {
    // The favorite songs read is cached per Profile: clear it so this test
    // sees the visibility it sets, not what an earlier spec cached.
    await revalidateProfileCache(request);
    await setProfileVisibilityMock({ [OWNER]: SHOWN_EXCEPT_FAVORITES });
    // Next serves the stale entry once while it refreshes in the background
    // (stale-while-revalidate), so wait until a visitor gets the new page.
    await expect
      .poll(async () => (await request.get(PROFILE_PATH)).text(), {
        timeout: 15_000,
      })
      .not.toContain('Favorite Song 00');
  });

  test('a visitor sees the shown sections and no trace of the hidden one', async ({
    page,
  }) => {
    await page.goto(PROFILE_PATH);

    await expect(
      page.getByRole('heading', { level: 2, name: 'Summary' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Favorite songs' }),
    ).toHaveCount(0);
    await expect(page.getByText('Favorite Song 00')).toHaveCount(0);
    await expect(page.getByRole('button', { name: HIDE_LABEL })).toHaveCount(0);
    await expect(page.getByRole('button', { name: SHOW_LABEL })).toHaveCount(0);
  });

  test('the owner sees the hidden section dimmed, labelled, with its toggle', async ({
    context,
    page,
  }) => {
    await context.addCookies([ownerCookie]);
    await mockAuthApi(page, { user: { ...ADA, username: OWNER } });
    await mockProfileVisibilityApi(page, { flags: SHOWN_EXCEPT_FAVORITES });

    await page.goto(PROFILE_PATH);

    await expect(
      page.getByRole('heading', { level: 2, name: 'Favorite songs' }),
    ).toBeVisible();
    const toggle = favorites(page).getByRole('button', { name: HIDE_LABEL });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(favorites(page)).toHaveAttribute('data-visible', 'false');
    await expect(favorites(page)).toHaveClass(/opacity-60/);
  });

  test('the toggle shows the section at once, saves it and confirms with a toast', async ({
    context,
    page,
  }) => {
    await context.addCookies([ownerCookie]);
    await mockAuthApi(page, { user: { ...ADA, username: OWNER } });
    const saves = await mockProfileVisibilityApi(page, {
      flags: SHOWN_EXCEPT_FAVORITES,
      reply: () => ({
        body: { summary: true, practiceHistory: true, favorites: true },
        delayMs: 1500,
      }),
    });
    await page.goto(PROFILE_PATH);

    await favorites(page).getByRole('button', { name: HIDE_LABEL }).click();

    // The save answers after 1.5 s: the change must already show.
    const toggle = favorites(page).getByRole('button', { name: SHOW_LABEL });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true', {
      timeout: 500,
    });
    await expect(favorites(page)).toHaveAttribute('data-visible', 'true');
    await expect(page.getByText('Visibility saved').first()).toBeVisible();
    expect(saves).toHaveLength(1);
    expect(saves[0]?.postDataJSON()).toEqual({ favorites: true });
  });

  test('a failed save rolls the toggle back and says so', async ({
    context,
    page,
  }) => {
    await context.addCookies([ownerCookie]);
    await mockAuthApi(page, { user: { ...ADA, username: OWNER } });
    const saves = await mockProfileVisibilityApi(page, {
      flags: SHOWN_EXCEPT_FAVORITES,
      reply: () => ({
        status: 500,
        body: {
          statusCode: 500,
          code: 'INTERNAL_ERROR',
          message: 'Broken on purpose',
        },
      }),
    });
    await page.goto(PROFILE_PATH);

    await favorites(page).getByRole('button', { name: HIDE_LABEL }).click();

    await expect(
      page.getByText('Could not save the visibility. Try again.').first(),
    ).toBeVisible();
    expect(saves).toHaveLength(1);
    await expect(
      favorites(page).getByRole('button', { name: HIDE_LABEL }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(favorites(page)).toHaveAttribute('data-visible', 'false');
  });

  test('the toggle is a keyboard-reachable pressed button', async ({
    context,
    page,
  }) => {
    await context.addCookies([ownerCookie]);
    await mockAuthApi(page, { user: { ...ADA, username: OWNER } });
    await mockProfileVisibilityApi(page, { flags: SHOWN_EXCEPT_FAVORITES });
    await page.goto(PROFILE_PATH);

    const toggle = favorites(page).getByRole('button', { name: HIDE_LABEL });
    await toggle.focus();
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('a visitor never sees a skeleton for a hidden section, not even while it loads', async ({
    page,
    request,
  }) => {
    // Every section is hidden and the reads are slow: a skeleton drawn for a
    // hidden section would show here, before the section disappears.
    await setProfileVisibilityMock(
      {
        [OWNER]: { summary: false, practiceHistory: false, favorites: false },
      },
      { delayMs: 600 },
    );
    // The flags are cached: wait until the page a visitor gets no longer has
    // a skeleton in it, so this test sees the new flags and not the old ones.
    await revalidateProfileCache(request);
    await expect
      .poll(
        async () =>
          (await request.get(PROFILE_PATH))
            .text()
            .then((html) => html.match(SKELETON_TEXT)?.[0] ?? null),
        { timeout: 20_000 },
      )
      .toBeNull();
    await watchForSkeletons(page);

    await page.goto(PROFILE_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');

    expect(await sawSkeleton(page)).toBe(false);
  });

  test('the skeleton watch does catch a skeleton for a shown section', async ({
    page,
  }) => {
    // The control: with the sections shown, the summary's skeleton does show
    // while its numbers load, so the watch above is a real check.
    await setProfileVisibilityMock({}, { delayMs: 600 });
    await watchForSkeletons(page);

    await page.goto(PROFILE_PATH);
    await page.waitForLoadState('networkidle');

    expect(await sawSkeleton(page)).toBe(true);
  });

  test('a visitor sees the shown counters and not the one of a hidden section', async ({
    page,
  }) => {
    await setProfileVisibilityMock({
      [OWNER]: { summary: true, practiceHistory: true, favorites: false },
    });
    await page.goto(PROFILE_PATH);

    const summary = page.locator(
      'section[aria-labelledby="profile-summary-title"]',
    );
    await expect(summary.getByText('Sung', { exact: true })).toBeVisible();
    await expect(summary.getByText('Favorites', { exact: true })).toHaveCount(
      0,
    );
  });

  test('a visitor sees no Sung counter when Practice history is hidden', async ({
    page,
  }) => {
    await setProfileVisibilityMock({
      [OWNER]: { summary: true, practiceHistory: false, favorites: true },
    });
    await page.goto(PROFILE_PATH);

    const summary = page.locator(
      'section[aria-labelledby="profile-summary-title"]',
    );
    await expect(summary.getByText('Favorites', { exact: true })).toBeVisible();
    await expect(summary.getByText('Sung', { exact: true })).toHaveCount(0);
  });

  test('the owner keeps a hidden section when her own read fails, and is told so', async ({
    context,
    page,
  }) => {
    await context.addCookies([ownerCookie]);
    await mockAuthApi(page, { user: { ...ADA, username: OWNER } });
    await mockProfileVisibilityApi(page, { flags: SHOWN_EXCEPT_FAVORITES });
    await setProfileVisibilityMock(
      { [OWNER]: SHOWN_EXCEPT_FAVORITES },
      { ownerFailing: ['favorites'] },
    );

    await page.goto(PROFILE_PATH);

    await expect(
      page.getByRole('heading', { level: 2, name: 'Favorite songs' }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Could not load this section' }),
    ).toBeVisible();
  });
});

const SKELETON_LABELS = ['Loading summary…', 'Loading practice history…'];
/** A skeleton's element in a visitor's HTML (its `aria-label` is its loading text). */
const SKELETON_TEXT = /aria-label="Loading (summary|practice history)/;

/**
 * Clears the Profile's cached banner, sections and favorites, so the next
 * visitor read is recomputed. Next then serves the stale entry once while it
 * refreshes, which is why specs wait for a fresh read after this.
 */
const revalidateProfileCache = async (request: APIRequestContext) => {
  const response = await request.post('/api/revalidate', {
    headers: { authorization: `Bearer ${webServerEnv.REVALIDATE_SECRET}` },
    data: { tags: CACHE_TAGS },
  });
  expect(response.ok()).toBe(true);
};

/** Records, for the whole load, whether a skeleton ever shows on the page. */
const watchForSkeletons = (page: Page) =>
  page.addInitScript((labels: string[]) => {
    const watched = window as unknown as { __skeletonSeen?: boolean };
    watched.__skeletonSeen = false;
    const look = () => {
      for (const label of labels) {
        if (document.querySelector(`[aria-label="${label}"]`)) {
          watched.__skeletonSeen = true;
        }
      }
    };
    new MutationObserver(look).observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    look();
  }, SKELETON_LABELS);

const sawSkeleton = (page: Page): Promise<boolean> =>
  page.evaluate(
    () =>
      (window as unknown as { __skeletonSeen?: boolean }).__skeletonSeen ===
      true,
  );

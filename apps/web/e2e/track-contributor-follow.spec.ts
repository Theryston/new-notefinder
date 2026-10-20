import {
  expect,
  type Locator,
  type Page,
  type Route,
  test,
} from '@playwright/test';
import { createTranslator } from 'next-intl';

import { ADA, mockAuthApi } from './auth-api-mock';
import { setTrackMock } from './fake-track-api';
import { messages as catalogs } from './messages';

// Follow and unfollow a Contributor from the Track's Contributors dialog. The
// contributors endpoint is served here, with the follow state of this test, so
// the flag the API adds for a signed-in viewer is under the test's control.
const SINGER = { ...ADA, username: 'ada_singer' };

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;

type Contributor = {
  userId: string;
  username: string;
  name: string;
  following: boolean;
};

const CONTRIBUTORS: Contributor[] = [
  {
    userId: 'usr_ada',
    username: 'ada_singer',
    name: 'Ada Lovelace',
    following: false,
  },
  {
    userId: 'usr_grace',
    username: 'grace_hopper',
    name: 'Grace Hopper',
    following: false,
  },
  {
    userId: 'usr_linus',
    username: 'linus_t',
    name: 'Linus Torvalds',
    following: true,
  },
];

const TRACK_ID = 'follow-contributors-track';

const completeTrack = (id: string) => ({
  id,
  title: 'Contributor follows',
  artistCredit: [],
  processing: {
    status: 'COMPLETED' as const,
    video: { id: 'dQw4w9WgXcQ', source: 'youtube_music' as const },
  },
  contributors: CONTRIBUTORS.map((contributor) => ({
    id: `contributor-${contributor.userId}`,
    username: contributor.username,
    name: contributor.name,
    image: null,
  })),
});

/**
 * The browser sends cookies cross-origin, so the reply echoes the request's
 * origin: a wildcard is refused for a credentialed request.
 */
async function reply(route: Route, status: number, body: unknown) {
  const origin = route.request().headers().origin ?? '*';
  await route.fulfill({
    status,
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS',
    },
    contentType: 'application/json',
    body: body === null ? '' : JSON.stringify(body),
  });
}

type Options = {
  /** Whether the browser sends a session, so the API adds the follow flag. */
  signedIn: boolean;
};

type FollowApi = {
  writes: string[];
  /** Makes the next follow write fail with a 500. */
  failNextWrite: boolean;
  /** Holds the next follow write until released, to observe the pending state. */
  gateNextWrite: Promise<void> | null;
};

/** The contributors page and the follow writes, over the state of this test. */
async function mockContributorsApi(
  page: Page,
  options: Options,
): Promise<FollowApi> {
  const state = CONTRIBUTORS.map((contributor) => ({ ...contributor }));
  const api: FollowApi = {
    writes: [],
    failNextWrite: false,
    gateNextWrite: null,
  };

  await page.route(`**/v1/tracks/${TRACK_ID}/contributors*`, async (route) => {
    if (route.request().method() === 'OPTIONS') return reply(route, 204, null);
    const items = state.map((contributor) => ({
      id: `contributor-${contributor.userId}`,
      userId: contributor.userId,
      username: contributor.username,
      name: contributor.name,
      image: null,
      ...(options.signedIn ? { isFollowing: contributor.following } : {}),
    }));
    return reply(route, 200, { items, nextCursor: null, total: items.length });
  });

  await page.route('**/v1/me/following/**', async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') return reply(route, 204, null);
    api.writes.push(method);
    const gate = api.gateNextWrite;
    api.gateNextWrite = null;
    if (gate !== null) await gate;
    if (api.failNextWrite) {
      api.failNextWrite = false;
      return reply(route, 500, {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Internal error',
      });
    }
    const userId = decodeURIComponent(
      route.request().url().split('/').pop() ?? '',
    );
    const contributor = state.find((item) => item.userId === userId);
    if (contributor) contributor.following = method === 'PUT';
    return reply(route, 204, null);
  });

  return api;
}

const openDialog = async (
  page: Page,
  locale: (typeof cases)[number]['locale'],
  messages: (typeof cases)[number]['messages'],
) => {
  const translate = createTranslator({
    locale,
    messages,
    namespace: 'tracks.practice',
  });
  await page.goto(`/${locale}/tracks/${TRACK_ID}`);
  await page
    .getByRole('button', {
      name: translate('contributorsOpen', { count: CONTRIBUTORS.length }),
    })
    .click();
  return { dialog: page.getByRole('dialog'), translate };
};

for (const { locale, messages } of cases) {
  const dialogText = messages.tracks.practice.contributorsDialog;
  const t = createTranslator({
    locale,
    messages,
    namespace: 'tracks.practice.contributorsDialog',
  });
  // The button's accessible name is the label for its Contributor.
  const button = (
    dialog: Locator,
    action: 'follow' | 'unfollow',
    name: string,
  ) =>
    dialog.getByRole('button', {
      name:
        action === 'follow'
          ? t('followLabel', { name })
          : t('unfollowLabel', { name }),
      exact: true,
    });

  test.describe(`follow a Contributor (${locale})`, () => {
    test.beforeEach(async () => {
      await setTrackMock({
        tracks: [completeTrack(TRACK_ID)],
      });
    });

    test('an anonymous visitor sees no follow buttons', async ({ page }) => {
      await mockAuthApi(page, { user: null });
      await mockContributorsApi(page, { signedIn: false });
      const { dialog } = await openDialog(page, locale, messages);

      await expect(dialog.getByRole('listitem')).toHaveCount(
        CONTRIBUTORS.length,
      );
      await expect(
        dialog.getByRole('button', { name: dialogText.follow, exact: true }),
      ).toHaveCount(0);
      await expect(
        dialog.getByRole('button', { name: dialogText.unfollow, exact: true }),
      ).toHaveCount(0);
    });

    test('a signed-in viewer follows and unfollows, and the button changes at once', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: { ...SINGER } });
      const api = await mockContributorsApi(page, { signedIn: true });
      const { dialog } = await openDialog(page, locale, messages);

      // The viewer's own row has no button; the others show their state.
      await expect(button(dialog, 'follow', 'Ada Lovelace')).toHaveCount(0);
      await expect(button(dialog, 'unfollow', 'Ada Lovelace')).toHaveCount(0);
      await expect(button(dialog, 'follow', 'Grace Hopper')).toBeEnabled();
      await expect(button(dialog, 'unfollow', 'Linus Torvalds')).toBeVisible();

      await button(dialog, 'follow', 'Grace Hopper').click();
      await expect(button(dialog, 'unfollow', 'Grace Hopper')).toBeVisible();

      await button(dialog, 'unfollow', 'Linus Torvalds').click();
      await expect(button(dialog, 'follow', 'Linus Torvalds')).toBeVisible();

      expect(api.writes).toEqual(['PUT', 'DELETE']);
    });

    test('the button is disabled while its request runs', async ({ page }) => {
      await mockAuthApi(page, { user: { ...SINGER } });
      const api = await mockContributorsApi(page, { signedIn: true });
      let release: () => void = () => {};
      api.gateNextWrite = new Promise<void>((resolve) => {
        release = resolve;
      });
      const { dialog } = await openDialog(page, locale, messages);

      // The change shows at once, so the pending button is the one that now
      // reads Unfollow.
      await button(dialog, 'follow', 'Grace Hopper').click();
      await expect(button(dialog, 'unfollow', 'Grace Hopper')).toBeDisabled();

      release();
      await expect(button(dialog, 'unfollow', 'Grace Hopper')).toBeEnabled();
    });

    test('a failed follow shows an error and puts the button back', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: { ...SINGER } });
      const api = await mockContributorsApi(page, { signedIn: true });
      api.failNextWrite = true;
      const { dialog } = await openDialog(page, locale, messages);

      await button(dialog, 'follow', 'Grace Hopper').click();

      await expect(dialog.getByRole('alert')).toHaveText(
        dialogText.followError,
      );
      await expect(button(dialog, 'follow', 'Grace Hopper')).toBeEnabled();
    });
  });
}

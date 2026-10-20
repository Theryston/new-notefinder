import { expect, type Page, test } from '@playwright/test';

import { ADA, mockAuthApi } from './auth-api-mock';
import {
  type FollowListActionsOptions,
  mockFollowListActions,
} from './follow-list-actions-api-mock';
import type { FollowListUserFixture } from './follow-lists-api-mock';
import { messages as catalogs } from './messages';

// The owner of a Profile acts on its lists: removes a follower from the
// followers list, unfollows from the following and friends lists. The fake API
// keeps the lists in memory, so the counts read back after an action match.
const PROFILE = 'follow_target';
const PROFILE_ID = 'follow-target-id';
const OWNER = { ...ADA, username: PROFILE };
const VIEWER = { ...ADA, username: 'ada_lovelace' };

const user = (id: string): FollowListUserFixture => ({
  id,
  username: id.replace('-', '_'),
  name: id,
  image: null,
});

// `idol-a` follows the Profile back, so it is a friend as well as a follower.
const LISTS: FollowListActionsOptions['lists'] = {
  followers: [user('fan-a'), user('fan-b'), user('idol-a')],
  following: [user('idol-a'), user('idol-b')],
  friends: [user('idol-a')],
};

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;

for (const { locale, messages } of cases) {
  const list = messages.publicProfile.followList;
  const profilePath = `/${locale}/users/${PROFILE}`;
  const countButton = (page: Page, index: number) =>
    page
      .getByRole('list', { name: messages.publicProfile.follow.label })
      .getByRole('listitem')
      .nth(index)
      .getByRole('button');
  const dialogOf = (page: Page) => page.getByRole('dialog');
  // A click before hydration is lost, so wait for the Profile to settle first.
  const gotoProfile = async (page: Page, path: string) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  };
  const rowButton = (page: Page, label: string) =>
    dialogOf(page).getByRole('button', { name: label, exact: true });
  const rows = (page: Page) => dialogOf(page).locator('ul li');
  // Closes the dialog, so the counts behind it are reachable by role again.
  const closeDialog = async (page: Page) => {
    await page.keyboard.press('Escape');
    await expect(dialogOf(page)).toBeHidden();
  };

  test.describe(`owner actions on follow lists (${locale})`, () => {
    test('the owner removes a follower, and the list and counts update', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: OWNER });
      const api = await mockFollowListActions(page, {
        username: PROFILE,
        userId: PROFILE_ID,
        lists: LISTS,
      });
      await gotoProfile(page, profilePath);
      await countButton(page, 0).click();

      await expect(rows(page)).toHaveCount(3);
      await rowButton(page, list.removeFollower).first().click();

      await expect(rows(page)).toHaveCount(2);
      await closeDialog(page);
      await expect(
        page.getByRole('list', { name: messages.publicProfile.follow.label }),
      ).toContainText(new Intl.NumberFormat(locale).format(2));
      expect(api.writes).toEqual(['remove-follower:fan-a']);
    });

    test('the owner unfollows from the following list, and the counts update', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: OWNER });
      const api = await mockFollowListActions(page, {
        username: PROFILE,
        userId: PROFILE_ID,
        lists: LISTS,
      });
      await gotoProfile(page, profilePath);
      await countButton(page, 1).click();

      await expect(
        dialogOf(page).getByRole('heading', { name: list.following }),
      ).toBeVisible();
      await rowButton(page, list.unfollow).first().click();

      await expect(rows(page)).toHaveCount(1);
      await closeDialog(page);
      await expect(
        page.getByRole('list', { name: messages.publicProfile.follow.label }),
      ).toContainText(new Intl.NumberFormat(locale).format(1));
      expect(api.writes).toEqual(['unfollow:idol-a']);
    });

    test('the owner unfollows a friend, who leaves the friends list', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: OWNER });
      await mockFollowListActions(page, {
        username: PROFILE,
        userId: PROFILE_ID,
        lists: LISTS,
      });
      await gotoProfile(page, profilePath);
      await countButton(page, 2).click();

      await rowButton(page, list.unfollow).first().click();

      await expect(
        dialogOf(page).getByText(list.emptyFriends, { exact: true }),
      ).toBeVisible();
    });

    test('a refused removal puts the row back and says why', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: OWNER });
      const api = await mockFollowListActions(page, {
        username: PROFILE,
        userId: PROFILE_ID,
        lists: LISTS,
        forbidWrites: true,
      });
      await gotoProfile(page, profilePath);
      await countButton(page, 0).click();
      await rowButton(page, list.removeFollower).first().click();

      await expect(
        page.getByText(messages.errors.FORBIDDEN, { exact: true }),
      ).toBeVisible();
      await expect(rows(page)).toHaveCount(3);
      expect(api.writes).toEqual([]);
      expect(api.current().followers).toEqual(['fan-a', 'fan-b', 'idol-a']);
    });

    test('a signed-in visitor who is not the owner sees no action on any list', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: VIEWER });
      await mockFollowListActions(page, {
        username: PROFILE,
        userId: PROFILE_ID,
        lists: LISTS,
      });
      await gotoProfile(page, profilePath);

      for (const index of [0, 1, 2]) {
        await countButton(page, index).click();
        await expect(dialogOf(page).locator('ul li a')).not.toHaveCount(0);
        await expect(rowButton(page, list.removeFollower)).toHaveCount(0);
        await expect(rowButton(page, list.unfollow)).toHaveCount(0);
        await closeDialog(page);
      }
    });
  });
}

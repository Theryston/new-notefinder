import { expect, type Page, test } from '@playwright/test';

import { mockAuthApi } from './auth-api-mock';
import { mockFollowApi } from './follow-api-mock';
import {
  type FollowListUserFixture,
  mockFollowLists,
} from './follow-lists-api-mock';
import { messages as catalogs } from './messages';

// The follow counts of a Profile open their lists in a dialog. The lists are
// read-only, paginated 20 at a time, and served by the fake API here: the
// followers list has 25 Users, so the second page loads only when scrolled to.
const PROFILE = 'follow_target';
const PROFILE_ID = 'follow-target-id';

const usersNamed = (prefix: string, count: number): FollowListUserFixture[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    username: `${prefix}_${index}`,
    name: `${prefix} ${index}`,
    image: null,
  }));

const LISTS = {
  followers: usersNamed('fan', 25),
  following: usersNamed('idol', 3),
  friends: [],
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

  test.describe(`follow lists (${locale})`, () => {
    test.beforeEach(async ({ page }) => {
      await mockAuthApi(page, { user: null });
      await mockFollowApi(page, {
        username: PROFILE,
        userId: PROFILE_ID,
        followers: LISTS.followers.length,
      });
      await mockFollowLists(page, { username: PROFILE, lists: LISTS });
    });

    test('the followers count opens the list, and the next page loads at the end', async ({
      page,
    }) => {
      await page.goto(profilePath);
      await countButton(page, 0).click();

      const dialog = dialogOf(page);
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('heading', { name: list.followers }),
      ).toBeVisible();
      const rows = dialog.locator('ul li a');
      await expect(rows).toHaveCount(20);

      await dialog.locator('ul').evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });

      await expect(rows).toHaveCount(25);
      await expect(rows.nth(24)).toHaveAttribute(
        'href',
        `/${locale}/users/fan_24`,
      );
    });

    test('rows link to their Profile and carry no action button', async ({
      page,
    }) => {
      await page.goto(profilePath);
      await countButton(page, 1).click();

      const dialog = dialogOf(page);
      await expect(
        dialog.getByRole('heading', { name: list.following }),
      ).toBeVisible();
      await expect(dialog.locator('ul li a')).toHaveCount(3);
      await expect(dialog.locator('ul li a').first()).toHaveAttribute(
        'href',
        `/${locale}/users/idol_0`,
      );
      // Only the dialog's close button; no row carries a follow action.
      await expect(dialog.getByRole('button')).toHaveCount(1);
    });

    test('an empty list shows the localized empty state', async ({ page }) => {
      await page.goto(profilePath);
      await countButton(page, 2).click();

      const dialog = dialogOf(page);
      await expect(
        dialog.getByRole('heading', { name: list.friends }),
      ).toBeVisible();
      await expect(
        dialog.getByText(list.emptyFriends, { exact: true }),
      ).toBeVisible();
    });
  });
}

import { expect, type Locator, type Page, test } from '@playwright/test';

import { ADA, mockAuthApi } from './auth-api-mock';
import { mockFollowApi } from './follow-api-mock';
import { messages as catalogs } from './messages';

// Follow and unfollow from a Profile, against the fake API. `follow_target`
// is the Profile followed (2 followers at the start, as its fixture says); `ada_lovelace` is the
// signed-in viewer, who is not its owner.
const PROFILE = 'follow_target';
const PROFILE_ID = 'follow-target-id';
const VIEWER = { ...ADA, username: 'ada_lovelace' };
const OWNER = { ...ADA, username: PROFILE };

// The button must read on the orange banner in either state: its label differs
// from its own fill, and the pill differs from the banner, by fill or by edge.
// Before the fix, Unfollow was white text on a white fill, and Follow an orange
// pill on the orange banner with no edge.
const expectReadable = async (button: Locator) => {
  const style = await button.evaluate((el) => {
    const computed = getComputedStyle(el);
    const banner = document.querySelector(
      'section[aria-labelledby="profile-name"]',
    );
    return {
      label: computed.color,
      fill: computed.backgroundColor,
      edge: computed.borderTopColor,
      edgeWidth: computed.borderTopWidth,
      bannerFill: banner ? getComputedStyle(banner).backgroundColor : '',
    };
  });
  expect(style.label).not.toBe(style.fill);
  expect(
    style.fill !== style.bannerFill ||
      (style.edgeWidth !== '0px' && style.edge !== style.bannerFill),
  ).toBe(true);
};

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;

for (const { locale, messages } of cases) {
  const follow = messages.publicProfile.follow;
  const profilePath = `/${locale}/users/${PROFILE}`;
  const counts = (page: Page) => page.getByRole('list', { name: follow.label });
  const followButton = (page: Page) =>
    page.getByRole('button', { name: follow.follow, exact: true });
  const unfollowButton = (page: Page) =>
    page.getByRole('button', { name: follow.unfollow, exact: true });

  test.describe(`follow a Profile (${locale})`, () => {
    test('a visitor sees the counts and no follow button', async ({ page }) => {
      await mockAuthApi(page, { user: null });
      const api = await mockFollowApi(page, {
        username: PROFILE,
        userId: PROFILE_ID,
        followers: 2,
      });
      await page.goto(profilePath);

      await expect(counts(page)).toContainText(
        new Intl.NumberFormat(locale).format(2),
      );
      await expect(followButton(page)).toHaveCount(0);
      await expect(unfollowButton(page)).toHaveCount(0);
      expect(api.writes).toEqual([]);
    });

    test('the owner sees the counts and no follow button', async ({ page }) => {
      await mockAuthApi(page, { user: OWNER });
      await mockFollowApi(page, {
        username: PROFILE,
        userId: PROFILE_ID,
        followers: 2,
      });
      await page.goto(profilePath);

      await expect(
        page.getByRole('heading', { level: 1, name: 'Follow Target' }),
      ).toBeVisible();
      await expect(followButton(page)).toHaveCount(0);
      await expect(unfollowButton(page)).toHaveCount(0);
    });

    test('a signed-in viewer follows and unfollows, and the counter moves', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: VIEWER });
      const api = await mockFollowApi(page, {
        username: PROFILE,
        userId: PROFILE_ID,
        followers: 2,
      });
      await page.goto(profilePath);

      await expect(followButton(page)).toBeEnabled();
      await expectReadable(followButton(page));
      await followButton(page).click();

      await expect(unfollowButton(page)).toBeVisible();
      await expectReadable(unfollowButton(page));
      await expect(counts(page)).toContainText(
        new Intl.NumberFormat(locale).format(3),
      );

      // A reload reads the follow state back from the API. The banner's own
      // render comes from the fake API, which cannot see the follow, so only
      // the button is checked here.
      await page.reload();
      await expect(unfollowButton(page)).toBeVisible();

      await unfollowButton(page).click();

      await expect(followButton(page)).toBeVisible();
      await expect(counts(page)).toContainText(
        new Intl.NumberFormat(locale).format(2),
      );
      expect(api.writes).toEqual(['PUT', 'DELETE']);
    });
  });
}

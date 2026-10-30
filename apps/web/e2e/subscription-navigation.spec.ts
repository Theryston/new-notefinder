import { expect, test } from '@playwright/test';
import { ADA, mockAuthApi } from './auth-api-mock';
import { messages } from './messages';
import { subscriptionFixture } from './subscription-fixture';

for (const locale of ['en', 'pt-BR'] as const) {
  for (const width of [360, 1280]) {
    for (const subscribed of [false, true]) {
      test(`${locale} account menu at ${width}px links to ${subscribed ? 'subscription' : 'plans'}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
        await page.route('**/v1/me/subscription?*', (route) =>
          route.fulfill({
            json: { subscription: subscribed ? subscriptionFixture() : null },
          }),
        );
        await page.goto(`/${locale}/subscription`);
        const account = messages[locale].header.account;
        await expect(
          page.getByRole('heading', {
            name: subscribed
              ? 'Pro'
              : messages[locale].billing.subscription.freePlan,
            exact: true,
          }),
        ).toBeVisible();
        await page
          .getByRole('button', { name: account.accountMenu, exact: true })
          .click();
        const destination = page.getByRole(width < 768 ? 'link' : 'menuitem', {
          name: subscribed ? account.subscription : account.plans,
          exact: true,
        });
        await expect(destination).toHaveAttribute(
          'href',
          `/${locale}/${subscribed ? 'subscription' : 'plans'}`,
        );
      });
    }
  }
}

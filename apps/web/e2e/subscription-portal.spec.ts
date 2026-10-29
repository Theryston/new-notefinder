import { expect, test } from '@playwright/test';
import { ADA, mockAuthApi } from './auth-api-mock';
import { messages } from './messages';

for (const locale of ['en', 'pt-BR'] as const) {
  test(`subscriber launches portal and sees cancellation on return in ${locale}`, async ({
    page,
  }) => {
    await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
    const subscription = {
      planId: 'pro',
      planName: 'Pro',
      cycle: 'monthly',
      currency: 'USD',
      amount: 350,
      status: 'confirmed',
      providerStatus: 'active',
      paidMembership: true,
      currentPeriodStart: '2026-10-28T12:00:00.000Z',
      currentPeriodEnd: '2027-10-28T12:00:00.000Z',
      cancelAtPeriodEnd: false,
    };
    await page.route('**/v1/me/subscription?*', (route) =>
      route.fulfill({ json: { subscription } }),
    );
    await page.route('**/v1/me/subscription/portal', async (route) => {
      expect(route.request().postDataJSON()).toEqual({ locale });
      await route.fulfill({
        json: {
          url: `http://localhost:3000/${locale}/subscription?portal=return`,
        },
      });
    });
    await page.goto(`/${locale}/subscription`);
    subscription.cancelAtPeriodEnd = true;
    await page
      .getByRole('button', {
        name: messages[locale].billing.subscription.manage,
      })
      .click();
    await page.waitForURL('**/subscription?portal=return');
    await expect(
      page.getByText(messages[locale].billing.subscription.endingDescription),
    ).toBeVisible();
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: messages[locale].billing.subscription.periodEnd }),
    ).toBeVisible();
  });
}

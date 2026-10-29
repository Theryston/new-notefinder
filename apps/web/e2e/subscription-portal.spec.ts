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
    await expect(
      page
        .getByText(messages[locale].billing.subscription.states.active)
        .first(),
    ).toBeVisible();
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
  test(`expired cancellation keeps its confirmed payment in ${locale}`, async ({
    page,
  }) => {
    await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
    await page.route('**/v1/me/subscription?*', (route) =>
      route.fulfill({
        json: {
          subscription: {
            planId: 'pro',
            planName: 'Pro',
            cycle: 'monthly',
            currency: 'USD',
            amount: 350,
            status: 'confirmed',
            providerStatus: 'canceled',
            paidMembership: false,
            currentPeriodStart: '2026-10-28T12:00:00.000Z',
            currentPeriodEnd: '2027-10-28T12:00:00.000Z',
            cancelAtPeriodEnd: true,
          },
        },
      }),
    );
    await page.goto(`/${locale}/subscription`);
    const t = messages[locale].billing.subscription;
    await expect(page.getByText(t.endedDescription)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: t.titles.ended }),
    ).toBeVisible();
    await expect(
      page.getByRole('listitem').filter({ hasText: t.payment.confirmed }),
    ).toBeVisible();
    await expect(
      page.getByRole('listitem').filter({ hasText: t.periodEnded }),
    ).toContainText(locale === 'en' ? 'Oct 28, 2027' : '28 de out. de 2027');
    await expect(page.getByText(t.payment.unsuccessful)).toHaveCount(0);
  });
}

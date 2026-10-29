import { expect, test } from '@playwright/test';
import type { Subscription } from '@vozzify/contracts';
import { ADA, mockAuthApi } from './auth-api-mock';
import { messages } from './messages';

for (const locale of ['en', 'pt-BR'] as const) {
  test(`shows recovery terms and restores the summary in ${locale}`, async ({
    page,
  }) => {
    await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
    const subscription: Subscription = {
      planId: 'pro',
      planName: 'Pro',
      cycle: 'monthly',
      currency: 'USD',
      amount: 350,
      status: 'confirmed',
      providerStatus: 'past_due',
      paidMembership: true,
      currentPeriodStart: '2026-10-28T12:00:00.000Z',
      currentPeriodEnd: '2026-11-28T12:00:00.000Z',
      cancelAtPeriodEnd: false,
      recoveryDeadline: '2026-11-30T12:00:00.000Z',
    };
    await page.route('**/v1/me/subscription?*', (route) =>
      route.fulfill({ json: { subscription } }),
    );
    await page.route('**/v1/me/subscription/portal', (route) =>
      route.fulfill({
        json: {
          url: `http://localhost:3000/${locale}/subscription?portal=return`,
        },
      }),
    );
    await page.goto(`/${locale}/subscription`);
    await expect(
      page.getByText(messages[locale].billing.subscription.states.overdue),
    ).toBeVisible();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText(
      locale === 'en'
        ? 'renewal payment failed'
        : 'pagamento da renovação falhou',
    );
    await expect(alert).toContainText(
      locale === 'en' ? 'Nov 30, 2026' : '30 de nov. de 2026',
    );
    subscription.paidMembership = false;
    await page.reload();
    await expect(alert).toHaveText(messages[locale].billing.recoverySuspended);
    await expect(
      page.getByText(messages[locale].billing.subscription.states.suspended),
    ).toBeVisible();
    subscription.paidMembership = true;
    subscription.providerStatus = 'active';
    subscription.recoveryDeadline = null;
    await page
      .getByRole('button', {
        name: messages[locale].billing.subscription.updatePayment,
      })
      .click();
    await page.waitForURL('**/subscription?portal=return');
    await expect(alert).toHaveCount(0);
    await expect(
      page
        .getByText(messages[locale].billing.subscription.states.active)
        .first(),
    ).toBeVisible();
  });
}

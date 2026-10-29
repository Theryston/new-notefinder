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
    const summary = page.getByRole('region', {
      name: messages[locale].billing.subscription.planSummary,
    });
    const timeline = page.getByRole('list').filter({
      hasText: messages[locale].billing.subscription.payment.overdue,
    });
    await expect(
      summary.getByText(messages[locale].billing.subscription.states.overdue),
    ).toBeVisible();
    await expect(
      timeline.getByText(messages[locale].billing.subscription.states.overdue),
    ).toBeVisible();
    const alert = page.getByRole('alert');
    const date = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(subscription.recoveryDeadline ?? ''));
    await expect(alert).toHaveText(
      messages[locale].billing.recoveryGrace.replace('{date}', date),
    );
    await expect(
      page.getByText(messages[locale].billing.confirmed),
    ).toHaveCount(0);
    await expect(
      page.getByText(messages[locale].billing.subscription.payment.confirmed),
    ).toHaveCount(0);
    await expect(
      page.getByRole('heading', {
        name: messages[locale].billing.subscription.titles.active,
      }),
    ).toHaveCount(0);
    subscription.paidMembership = false;
    await page.reload();
    await expect(alert).toHaveText(messages[locale].billing.recoverySuspended);
    await expect(
      page.getByText(messages[locale].billing.confirmed),
    ).toHaveCount(0);
    await expect(
      page.getByText(messages[locale].billing.subscription.payment.confirmed),
    ).toHaveCount(0);
    await expect(
      summary.getByText(messages[locale].billing.subscription.states.suspended),
    ).toBeVisible();
    await expect(
      timeline.getByText(
        messages[locale].billing.subscription.states.suspended,
      ),
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

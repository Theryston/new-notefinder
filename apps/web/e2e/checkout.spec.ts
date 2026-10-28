import { expect, test } from '@playwright/test';
import type { Subscription } from '@vozzify/contracts';
import { ADA, mockAuthApi } from './auth-api-mock';
import { messages } from './messages';

for (const status of ['pending', 'confirmed', 'unsuccessful'] as const) {
  test(`private subscription shows ${status} in its contracted currency`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
    const subscription: Subscription = {
      planId: 'pro',
      planName: 'Pro',
      cycle: 'monthly',
      currency: 'BRL',
      amount: 1990,
      status,
      providerStatus: status === 'confirmed' ? 'active' : 'incomplete',
      paidMembership: status === 'confirmed',
      currentPeriodStart: '2026-10-28T12:00:00.000Z',
      currentPeriodEnd: '2026-11-28T12:00:00.000Z',
      cancelAtPeriodEnd: false,
    };
    await page.route('**/v1/me/subscription?*', (route) =>
      route.fulfill({ json: { subscription } }),
    );
    await page.goto('/en/subscription?result=pending');
    await expect(
      page.getByText(messages.en.billing[status], { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('BRL', { exact: true })).toBeVisible();
    await expect(page.getByText('R$19.90', { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
}

test('switching Users in one browser never reuses another User subscription', async ({
  page,
}) => {
  let current: typeof ADA | null = { ...ADA, username: 'ada' };
  let documents = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.resourceType() === 'document')
      documents += 1;
  });
  await mockAuthApi(page, {
    user: current,
    overrides: {
      '/get-session': () => ({
        body: current ? { session: { id: 'session' }, user: current } : null,
      }),
      '/sign-out': () => {
        current = null;
        return { body: { success: true } };
      },
      '/sign-in/email': () => {
        current = {
          ...ADA,
          id: 'usr_bob',
          username: 'bob',
          email: 'bob@example.com',
        };
        return { body: { token: 'bob', user: current } };
      },
    },
  });
  await page.route('**/v1/me/subscription?*', (route) =>
    route.fulfill({
      json: {
        subscription:
          current?.id === ADA.id
            ? {
                planId: 'pro',
                planName: 'Ada private plan',
                cycle: 'monthly',
                currency: 'USD',
                amount: 350,
                status: 'confirmed',
                providerStatus: 'active',
                paidMembership: true,
                currentPeriodStart: null,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
              }
            : null,
      },
    }),
  );
  await page.goto('/en/subscription');
  await expect(
    page.getByRole('heading', { name: 'Ada private plan' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: messages.en.header.account.accountMenu })
    .click();
  await page
    .getByRole('menuitem', { name: messages.en.header.account.signOut })
    .click();
  await expect(page).toHaveURL(/sign-in/);
  await page
    .getByLabel(messages.en.auth.signIn.emailOrUsername.label)
    .fill('bob@example.com');
  await page
    .getByLabel(messages.en.auth.fields.password.label, { exact: true })
    .fill('correct-password');
  await page
    .getByRole('button', { name: messages.en.auth.signIn.submit, exact: true })
    .click();
  await expect(page).toHaveURL(/\/en\/subscription$/);
  await expect(
    page.getByText(messages.en.billing.noSubscription, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Ada private plan' }),
  ).toHaveCount(0);
  expect(documents).toBe(1);
});

test('switching the summary language retains contract currency with a clean console', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
  const subscription: Subscription = {
    planId: 'pro',
    planName: 'Pro',
    cycle: 'monthly',
    currency: 'USD',
    amount: 350,
    status: 'confirmed',
    providerStatus: 'active',
    paidMembership: true,
    currentPeriodStart: '2026-10-28T12:00:00.000Z',
    currentPeriodEnd: '2026-11-28T12:00:00.000Z',
    cancelAtPeriodEnd: false,
  };
  await page.route('**/v1/me/subscription?*', (route) =>
    route.fulfill({ json: { subscription } }),
  );
  await page.route('**/v1/me/acquisition', (route) =>
    route.fulfill({ status: 201, json: { recorded: true } }),
  );
  await page.goto('/en/subscription?result=pending');
  await expect(
    page.getByRole('main').getByText('USD', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('contentinfo')
    .getByRole('group', { name: messages.en.header.preferences.language })
    .getByRole('button', {
      name: messages.en.header.preferences.languages['pt-BR'],
    })
    .click();
  await expect(page).toHaveURL(/\/pt-BR\/subscription\?result=pending$/);
  await expect(
    page.getByText(messages['pt-BR'].billing.confirmed, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('main').getByText('USD', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('main').getByText('US$ 3,50', { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

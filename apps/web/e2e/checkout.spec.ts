import type { Subscription } from '@notefinder/contracts';
import { expect, test } from '@playwright/test';
import { ADA, mockAuthApi } from './auth-api-mock';
import { defaultPlanCatalog } from './fake-plans-api';
import { messages } from './messages';

for (const locale of ['en', 'pt-BR'] as const) {
  for (const cycle of ['monthly', 'annual'] as const) {
    test(`checkout discloses future benefits and sends the ${locale} ${cycle} catalog offer`, async ({
      page,
    }) => {
      await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
      const catalog = defaultPlanCatalog(locale);
      const pro = catalog.plans.find((plan) => plan.id === 'pro');
      if (!pro) throw new Error('Expected Pro');
      pro.saleAvailable = true;
      await page.route('**/v1/plans?*', (route) =>
        route.fulfill({ json: catalog }),
      );
      let requested: unknown;
      await page.route('**/v1/me/subscription/checkout', async (route) => {
        if (route.request().method() === 'OPTIONS')
          return route.fulfill({
            status: 204,
            headers: {
              'access-control-allow-origin': '*',
              'access-control-allow-headers': 'content-type',
              'access-control-allow-methods': 'POST',
            },
          });
        requested = route.request().postDataJSON();
        await route.fulfill({
          json: {
            action: 'checkout',
            url: 'https://checkout.stripe.com/c/pay/nf-test',
          },
        });
      });
      await page.route('https://checkout.stripe.com/**', (route) =>
        route.fulfill({ body: '<html></html>', contentType: 'text/html' }),
      );
      await page.goto(
        `/${locale}/subscribe?plan=pro&cycle=${cycle}&offer=${cycle}`,
      );
      const t = messages[locale].billing;
      await expect(
        page.getByRole('heading', {
          name: t.checkoutTitle.replace('{plan}', 'Pro'),
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('list').getByText(t.comingSoon, { exact: false }),
      ).toHaveCount(7);
      const pay = page.getByRole('button', { name: t.pay });
      await expect(pay).toBeDisabled();
      await page.getByRole('checkbox').check();
      await pay.click();
      await expect(page).toHaveURL(/checkout.stripe.com/);
      expect(requested).toEqual({
        planId: 'pro',
        offerId: cycle,
        cycle,
        locale,
        comingSoonAcknowledged: true,
      });
    });
  }
}
test('sign-in and username onboarding preserve the intended offer', async ({
  page,
}) => {
  let signedIn = false;
  await mockAuthApi(page, {
    overrides: {
      '/sign-in/email': () => {
        signedIn = true;
        return { body: { token: 'token', user: ADA } };
      },
      '/get-session': () => ({
        body: signedIn ? { session: { id: 'session' }, user: ADA } : null,
      }),
    },
  });
  const path = '/subscribe?plan=pro&cycle=annual&offer=annual';
  await page.goto(`/en${path}`);
  await expect(page).toHaveURL(/sign-in/);
  expect(new URL(page.url()).searchParams.get('redirectTo')).toBe(path);
  await page
    .getByLabel(messages.en.auth.signIn.emailOrUsername.label)
    .fill(ADA.email);
  await page
    .getByLabel(messages.en.auth.fields.password.label, { exact: true })
    .fill('correct-password');
  await page
    .getByRole('button', { name: messages.en.auth.signIn.submit, exact: true })
    .click();
  await expect(page).toHaveURL(/setup-username/);
  expect(new URL(page.url()).searchParams.get('redirectTo')).toBe(path);
});

test('stale offers remain recoverable before payment', async ({ page }) => {
  await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
  await page.route('**/v1/plans?*', (route) =>
    route.fulfill({ json: defaultPlanCatalog('en') }),
  );
  await page.goto('/en/subscribe?plan=pro&cycle=annual&offer=stale');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    messages.en.billing.unavailable,
  );
});

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
    await expect(page.getByText('Contract currency: BRL')).toBeVisible();
    await expect(page.getByText(/R\$19.90/)).toBeVisible();
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
  await expect(page.getByText('Contract currency: USD')).toBeVisible();
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
    page.getByText(
      messages['pt-BR'].billing.contractCurrency.replace('{currency}', 'USD'),
    ),
  ).toBeVisible();
  await expect(page.getByText(/US\$.*3,50/)).toBeVisible();
  expect(errors).toEqual([]);
});

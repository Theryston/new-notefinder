import { expect, type Page, test } from '@playwright/test';
import type { Locale, PlanCatalog } from '@vozzify/contracts';
import { ADA, mockAuthApi } from './auth-api-mock';
import { defaultPlanCatalog } from './fake-plans-api';
import { messages } from './messages';

type InstallCatalog = (
  locale: Locale,
  reply: { catalog?: PlanCatalog; status?: number; delayMs?: number },
) => Promise<void>;

const STRIPE_URL = 'https://checkout.stripe.com/c/pay/nf-test';

async function mockCheckout(
  page: Page,
  action: 'checkout' | 'manage' = 'checkout',
  beforeReply?: () => Promise<void>,
) {
  const requests: unknown[] = [];
  await page.route('**/v1/me/subscription/checkout', async (route) => {
    const origin = route.request().headers().origin ?? '*';
    const headers = {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'POST',
    };
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers });
    requests.push(route.request().postDataJSON());
    await beforeReply?.();
    await route.fulfill({
      headers,
      json: action === 'checkout' ? { action, url: STRIPE_URL } : { action },
    });
  });
  await page.route('https://checkout.stripe.com/**', (route) =>
    route.fulfill({ body: '<html></html>', contentType: 'text/html' }),
  );
  return requests;
}

async function selectCycle(
  page: Page,
  locale: Locale,
  cycle: 'monthly' | 'annual',
) {
  await page
    .getByRole('radio', { name: new RegExp(messages[locale].plans[cycle]) })
    .check();
}

async function submitCheckout(page: Page, locale: Locale) {
  await page
    .getByRole('button', {
      name: messages[locale].plans.choosePlan.replace('{plan}', 'Pro'),
    })
    .click();
}

async function enableCheckout(install: InstallCatalog, locale: Locale) {
  const catalog = defaultPlanCatalog(locale);
  const pro = catalog.plans.find((plan) => plan.id === 'pro');
  if (!pro) throw new Error('Expected Pro');
  pro.saleAvailable = true;
  await install(locale, { catalog });
}

// Tag invalidation serves a stale response while refreshing the enabled catalog.
async function openPlans(page: Page, path: string) {
  await expect(async () => {
    await page.goto(path);
    await expect(
      page
        .getByRole('article', { name: 'Pro', exact: true })
        .getByRole('button')
        .first(),
    ).toBeVisible();
  }).toPass();
}

export function registerPlanCheckoutJourneys(install: InstallCatalog) {
  for (const locale of ['en', 'pt-BR'] as const) {
    for (const cycle of ['monthly', 'annual'] as const) {
      test(`plans disclose future benefits and open Stripe directly for ${locale} ${cycle}`, async ({
        page,
      }) => {
        await enableCheckout(install, locale);
        await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
        const requests = await mockCheckout(page);
        const documents: string[] = [];
        page.on('request', (request) => {
          if (request.isNavigationRequest()) documents.push(request.url());
        });
        await openPlans(page, `/${locale}/plans`);
        const pro = page.getByRole('article', { name: 'Pro', exact: true });
        await expect(
          pro.getByText(messages[locale].plans.comingSoon, { exact: true }),
        ).toHaveCount(1);
        await expect(pro.getByRole('listitem')).toHaveCount(7);
        await expect(pro.getByRole('checkbox')).toHaveCount(0);
        await selectCycle(page, locale, cycle);
        await submitCheckout(page, locale);
        await expect(page).toHaveURL(STRIPE_URL);
        expect(requests).toEqual([
          {
            planId: 'pro',
            offerId: cycle,
            cycle,
            locale,
            comingSoonAcknowledged: true,
          },
        ]);
        expect(documents.some((url) => url.includes('/subscribe'))).toBe(false);
        await install(locale, { catalog: defaultPlanCatalog(locale) });
      });
    }
  }
  registerSignInJourney(install);
  registerResumeJourney(install);
  registerCheckoutPendingJourney(install);
  registerCheckoutRecoveryJourneys(install);
}

function registerCheckoutPendingJourney(install: InstallCatalog) {
  test('checkout shows a neutral loading label and disables repeated selections', async ({
    page,
  }) => {
    await enableCheckout(install, 'pt-BR');
    await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
    let release = () => {};
    const response = new Promise<void>((resolve) => {
      release = resolve;
    });
    const requests = await mockCheckout(page, 'checkout', () => response);
    await openPlans(page, '/pt-BR/plans');
    const pro = page.getByRole('article', { name: 'Pro', exact: true });
    await selectCycle(page, 'pt-BR', 'monthly');
    await submitCheckout(page, 'pt-BR');
    const loading = pro.getByRole('button', {
      name: messages['pt-BR'].billing.redirecting,
    });
    await expect(loading).toBeVisible();
    await expect(loading).toBeDisabled();
    await expect(
      pro.getByRole('radio', {
        name: new RegExp(messages['pt-BR'].plans.annual),
      }),
    ).toBeDisabled();
    await expect(pro.getByRole('button', { name: /stripe/i })).toHaveCount(0);
    expect(requests).toHaveLength(1);
    release();
    await expect(page).toHaveURL(STRIPE_URL);
    await page.goBack();
    await expect(
      pro.getByRole('radio', {
        name: new RegExp(messages['pt-BR'].plans.annual),
      }),
    ).toBeEnabled();
    await selectCycle(page, 'pt-BR', 'annual');
    await submitCheckout(page, 'pt-BR');
    await expect(page).toHaveURL(STRIPE_URL);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ cycle: 'annual', offerId: 'annual' });
    await install('pt-BR', { catalog: defaultPlanCatalog('pt-BR') });
  });
}

function registerSignInJourney(install: InstallCatalog) {
  test('sign-in and username onboarding preserve the offer selected from plans', async ({
    page,
  }) => {
    await enableCheckout(install, 'en');
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
    const requests = await mockCheckout(page);
    const path = '/plans?plan=pro&cycle=annual&offer=annual';
    await openPlans(page, '/en/plans');
    await selectCycle(page, 'en', 'annual');
    await submitCheckout(page, 'en');
    await expect(page).toHaveURL(/sign-in/);
    expect(new URL(page.url()).searchParams.get('redirectTo')).toBe(path);
    await page
      .getByLabel(messages.en.auth.signIn.emailOrUsername.label)
      .fill(ADA.email);
    await page
      .getByLabel(messages.en.auth.fields.password.label, { exact: true })
      .fill('correct-password');
    await page
      .getByRole('button', {
        name: messages.en.auth.signIn.submit,
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/setup-username/);
    expect(new URL(page.url()).searchParams.get('redirectTo')).toBe(path);
    expect(requests).toEqual([]);
    await install('en', { catalog: defaultPlanCatalog('en') });
  });
}

function registerResumeJourney(install: InstallCatalog) {
  test('a completed sign-in resumes the selected offer directly from plans', async ({
    page,
  }) => {
    await enableCheckout(install, 'pt-BR');
    let signedIn = false;
    const user = { ...ADA, username: 'ada' };
    await mockAuthApi(page, {
      overrides: {
        '/sign-in/email': () => {
          signedIn = true;
          return { body: { token: 'token', user } };
        },
        '/get-session': () => ({
          body: signedIn ? { session: { id: 'session' }, user } : null,
        }),
      },
    });
    const requests = await mockCheckout(page);
    await openPlans(page, '/pt-BR/plans');
    await selectCycle(page, 'pt-BR', 'monthly');
    await submitCheckout(page, 'pt-BR');
    await expect(page).toHaveURL(/sign-in/);
    await page
      .getByLabel(messages['pt-BR'].auth.signIn.emailOrUsername.label)
      .fill(ADA.email);
    await page
      .getByLabel(messages['pt-BR'].auth.fields.password.label, { exact: true })
      .fill('correct-password');
    await page
      .getByRole('button', {
        name: messages['pt-BR'].auth.signIn.submit,
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(STRIPE_URL);
    expect(requests).toEqual([
      {
        planId: 'pro',
        offerId: 'monthly',
        cycle: 'monthly',
        locale: 'pt-BR',
        comingSoonAcknowledged: true,
      },
    ]);
    await install('pt-BR', { catalog: defaultPlanCatalog('pt-BR') });
  });
}

function registerCheckoutRecoveryJourneys(install: InstallCatalog) {
  test('stale offers remain recoverable from the plan comparison before payment', async ({
    page,
  }) => {
    await enableCheckout(install, 'en');
    await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
    const requests = await mockCheckout(page);
    await openPlans(page, '/en/plans?plan=pro&cycle=annual&offer=stale');
    await expect(page).toHaveURL('/en/plans?plan=pro&cycle=annual&offer=stale');
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      messages.en.billing.unavailable,
    );
    expect(requests).toEqual([]);
    await selectCycle(page, 'en', 'annual');
    await submitCheckout(page, 'en');
    await expect(page).toHaveURL(STRIPE_URL);
    expect(requests).toHaveLength(1);
    await install('en', { catalog: defaultPlanCatalog('en') });
  });
  test('an existing subscription opens its summary directly from plans', async ({
    page,
  }) => {
    await enableCheckout(install, 'en');
    await mockAuthApi(page, { user: { ...ADA, username: 'ada' } });
    const requests = await mockCheckout(page, 'manage');
    await page.route('**/v1/me/subscription?*', (route) =>
      route.fulfill({ json: { subscription: null } }),
    );
    await openPlans(page, '/en/plans');
    await selectCycle(page, 'en', 'monthly');
    await submitCheckout(page, 'en');
    await expect(page).toHaveURL('/en/subscription');
    expect(requests).toHaveLength(1);
    await install('en', { catalog: defaultPlanCatalog('en') });
  });
}

import { expect, type Page, test } from '@playwright/test';

import {
  ADA,
  mockAuthApi,
  RIGHT_OTP,
  TAKEN_USERNAME,
  WRONG_OTP,
} from './auth-api-mock';
import { messages } from './messages';

const { auth, authErrors } = messages.en;
// The link text inside the `<link>` tag of the rich message.
const signInLabel =
  /<link>(.*)<\/link>/.exec(auth.signUp.haveAccount)?.[1] ?? '';

async function fillSignUp(page: Page) {
  await page.getByLabel(auth.fields.name.label).fill('Ada Lovelace');
  await page.getByLabel(auth.fields.email.label).fill('ada@example.com');
  await page
    .getByLabel(auth.fields.password.label, { exact: true })
    .fill('analytical-1843');
}

test.describe('sign-up flow', () => {
  test('creates the account, verifies the email and picks a username', async ({
    page,
  }) => {
    const calls = await mockAuthApi(page);
    await page.goto('/en/sign-up?redirectTo=%2F%3Ffrom%3Dsign-up');

    await fillSignUp(page);
    await page.getByRole('button', { name: auth.signUp.submit }).click();

    await expect(page).toHaveURL(
      /\/en\/verify-email\?email=ada%40example\.com&redirectTo=%2F%3Ffrom%3Dsign-up$/,
    );
    await expect(page.getByText('ada@example.com')).toBeVisible();
    const signUp = calls.find((call) => call.url().endsWith('/sign-up/email'));
    expect(signUp?.postDataJSON()).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'analytical-1843',
    });

    const code = page.getByLabel(auth.verifyEmail.codeLabel);
    await code.pressSequentially(WRONG_OTP);
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(
      authErrors.INVALID_OTP,
    );
    await code.pressSequentially(RIGHT_OTP);

    await expect(page).toHaveURL(/\/en\/setup-username\?redirectTo=/);
    const username = page.getByLabel(auth.fields.username.label);
    await expect(username).toHaveValue(/^ada_lovelace_\d{4}$/);

    await username.fill(TAKEN_USERNAME);
    await expect(
      page.getByText(`@${TAKEN_USERNAME} is already taken.`),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: auth.setupUsername.submit }),
    ).toBeDisabled();

    await username.fill('Ada Lovelace');
    await expect(username).toHaveValue('ada_lovelace');
    await expect(page.getByText('@ada_lovelace is available.')).toBeVisible();
    await page.getByRole('button', { name: auth.setupUsername.submit }).click();

    await expect(page).toHaveURL(/\/en\?from=sign-up$/);
    const update = calls.find((call) => call.url().endsWith('/me/username'));
    expect(update?.method()).toBe('PUT');
    expect(update?.postDataJSON()).toEqual({ username: 'ada_lovelace' });
    expect(calls.some((call) => call.url().endsWith('/update-user'))).toBe(
      false,
    );
  });

  test('keeps what was typed before the page hydrated', async ({ page }) => {
    const calls = await mockAuthApi(page);
    // Slow scripts make sure the fields are filled before React takes over.
    // Only the first load: chunks loaded on submit (validation, the auth
    // client) come at normal speed.
    let slowScripts = true;
    await page.route('**/_next/static/chunks/*.js', async (route) => {
      if (slowScripts)
        await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.goto('/en/sign-up', { waitUntil: 'commit' });

    await fillSignUp(page);
    slowScripts = false;
    await page.getByRole('button', { name: auth.signUp.submit }).click();

    await expect(page).toHaveURL(
      /\/en\/verify-email\?email=ada%40example\.com$/,
    );
    const signUp = calls.find((call) => call.url().endsWith('/sign-up/email'));
    expect(signUp?.postDataJSON()).toMatchObject({ name: 'Ada Lovelace' });
  });

  test('validates the fields before calling the API', async ({ page }) => {
    const calls = await mockAuthApi(page);
    await page.goto('/en/sign-up');

    await page.getByLabel(auth.fields.email.label).fill('not-an-email');
    const password = page.getByLabel(auth.fields.password.label, {
      exact: true,
    });
    await password.fill('123');
    // Enter, not a click: the email error that appears on blur moves the
    // button, which can make a click land where the button used to be.
    await password.press('Enter');

    await expect(
      page.getByText(auth.fields.name.errors.required),
    ).toBeVisible();
    await expect(
      page.getByText(auth.fields.email.errors.invalid),
    ).toBeVisible();
    await expect(
      page.getByText(auth.fields.password.errors.tooShort),
    ).toBeVisible();
    expect(
      calls.filter((call) => call.url().endsWith('/sign-up/email')),
    ).toHaveLength(0);
  });

  test('never submits the form natively before hydration', async ({ page }) => {
    await page.goto('/en/sign-up', { waitUntil: 'commit' });
    const submit = page.getByRole('button', { name: auth.signUp.submit });
    await submit.waitFor();

    // The prerendered button is disabled until React takes over the form.
    const html = await (await page.request.get('/en/sign-up')).text();
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
    await expect(submit).toBeEnabled();
  });

  test('shows a translated message when the API fails', async ({ page }) => {
    await mockAuthApi(page, {
      overrides: {
        '/sign-up/email': () => ({
          status: 429,
          body: { message: 'Slow down' },
        }),
      },
    });
    await page.goto('/pt-BR/sign-up');
    const pt = messages['pt-BR'];

    await page.getByLabel(pt.auth.fields.name.label).fill('Ada Lovelace');
    await page.getByLabel(pt.auth.fields.email.label).fill('ada@example.com');
    await page
      .getByLabel(pt.auth.fields.password.label, { exact: true })
      .fill('analytical-1843');
    await page.getByRole('button', { name: pt.auth.signUp.submit }).click();

    await expect(page.getByRole('main').getByRole('alert')).toHaveText(
      pt.authErrors.RATE_LIMITED,
    );
    await expect(page).toHaveURL(/\/pt-BR\/sign-up$/);
  });

  test('sends Google sign-ups back to the right pages', async ({
    page,
    baseURL,
  }) => {
    const calls = await mockAuthApi(page, {
      overrides: { '/sign-in/social': () => ({ status: 500, body: {} }) },
    });
    await page.goto('/en/sign-up?redirectTo=%2Fme%2Fedit');

    await page.getByRole('button', { name: auth.signUp.google }).click();

    await expect(page.getByRole('main').getByRole('alert')).toHaveText(
      auth.signUp.googleError,
    );
    const social = calls.find((call) => call.url().endsWith('/sign-in/social'));
    expect(social?.postDataJSON()).toMatchObject({
      provider: 'google',
      callbackURL: `${baseURL}/en/me/edit`,
      newUserCallbackURL: `${baseURL}/en/setup-username?redirectTo=%2Fme%2Fedit`,
      errorCallbackURL: `${baseURL}/en/sign-up?redirectTo=%2Fme%2Fedit`,
    });
  });

  test('ignores an external redirectTo', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/en/sign-up?redirectTo=https%3A%2F%2Fevil.example');

    await expect(page.getByRole('link', { name: signInLabel })).toHaveAttribute(
      'href',
      '/en/sign-in',
    );
  });
});

test.describe('verify-email and setup-username guards', () => {
  test('keeps the resend countdown across reloads', async ({ page }) => {
    await mockAuthApi(page);
    // A code sent 45 s ago in this browser (as sign-up records it).
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(
        'notefinder:otp-sent-at:ada@example.com',
        String(Date.now() - 45_000),
      );
    });
    const resend = page.getByRole('button', { name: /Resend code in 1[0-5]s/ });

    await page.goto('/en/verify-email?email=ada%40example.com');
    await expect(resend).toBeDisabled();
    await page.reload();
    await expect(resend).toBeDisabled();
  });

  test('restarts the countdown after a resend', async ({ page }) => {
    const calls = await mockAuthApi(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        'notefinder:otp-sent-at:ada@example.com',
        String(Date.now() - 120_000),
      );
    });
    await page.goto('/en/verify-email?email=ada%40example.com');

    await page
      .getByRole('button', { name: auth.verifyEmail.resend, exact: true })
      .click();

    await expect(page.getByRole('main').getByRole('status')).toHaveText(
      auth.verifyEmail.resent,
    );
    expect(
      calls.some((call) => call.url().endsWith('/send-verification-otp')),
    ).toBe(true);
    const stored = await page.evaluate(() =>
      Number(localStorage.getItem('notefinder:otp-sent-at:ada@example.com')),
    );
    expect(Date.now() - stored).toBeLessThan(10_000);
  });

  test('asks for an account when the email is missing', async ({ page }) => {
    await page.goto('/en/verify-email');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: auth.verifyEmail.missing.title,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: auth.verifyEmail.missing.cta }),
    ).toHaveAttribute('href', '/en/sign-up');
  });

  test('sends signed-out visitors to sign in', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/en/setup-username?redirectTo=%2Fme%2Fedit');

    await expect(page).toHaveURL(/\/en\/sign-in\?redirectTo=%2Fme%2Fedit$/);
  });
});

test.describe('setup-username step', () => {
  const refusals = [
    [409, 'CONFLICT', authErrors.USERNAME_IS_ALREADY_TAKEN],
    [400, 'VALIDATION_FAILED', authErrors.INVALID_USERNAME],
    [429, 'RATE_LIMITED', authErrors.RATE_LIMITED],
    [401, 'UNAUTHORIZED', authErrors.UNAUTHORIZED],
  ] as const;

  for (const [status, code, message] of refusals) {
    test(`shows the message for a ${code} answer`, async ({ page }) => {
      const calls = await mockAuthApi(page, {
        user: ADA,
        overrides: {
          '/me/username': () => ({
            status,
            body: { statusCode: status, code, message: 'Refused' },
          }),
        },
      });
      await page.goto('/en/setup-username?redirectTo=%2Fme%2Fedit');

      await page.getByLabel(auth.fields.username.label).fill('ada_lovelace');
      await page
        .getByRole('button', { name: auth.setupUsername.submit })
        .click();

      await expect(page.getByRole('main').getByRole('alert')).toHaveText(
        message,
      );
      await expect(page).toHaveURL(/\/en\/setup-username\?/);
      expect(calls.some((call) => call.url().endsWith('/me/username'))).toBe(
        true,
      );
    });
  }
});

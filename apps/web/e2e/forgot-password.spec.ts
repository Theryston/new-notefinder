import { expect, type Page, type Request, test } from '@playwright/test';

import { mockAuthApi, RIGHT_OTP, WRONG_OTP } from './auth-api-mock';
import { messages } from './messages';

const { auth, authErrors } = messages.en;
const { forgotPassword } = auth;
const RESET_SENT_AT_KEY =
  'notefinder:otp-sent-at:forget-password:ada@example.com';

const bodyOf = (request: Request): Record<string, unknown> =>
  request.postDataJSON() ?? {};

/**
 * The password reset endpoints: requesting a code always succeeds (the API
 * doesn't tell whether the email has an account), resetting checks the code.
 */
const resetOverrides = {
  '/email-otp/request-password-reset': () => ({ body: { success: true } }),
  '/email-otp/reset-password': (request: Request) =>
    bodyOf(request).otp === RIGHT_OTP
      ? { body: { success: true } }
      : { status: 400, body: { code: 'INVALID_OTP', message: 'Invalid OTP' } },
};

const mockResetApi = (page: Page) =>
  mockAuthApi(page, { overrides: resetOverrides });

const callsTo = (calls: Request[], path: string) =>
  calls.filter((call) => call.url().endsWith(path));

test.describe('forgot password flow', () => {
  test('requests a code and resets the password', async ({ page }) => {
    const calls = await mockResetApi(page);
    await page.goto('/en/forgot-password?redirectTo=%2Fme%2Fedit');

    await page.getByLabel(auth.fields.email.label).fill('ada@example.com');
    await page
      .getByRole('button', { name: forgotPassword.request.submit })
      .click();

    await expect(page).toHaveURL(
      /\/en\/forgot-password\/reset\?email=ada%40example\.com&redirectTo=%2Fme%2Fedit$/,
    );
    await expect(page.getByText('ada@example.com')).toBeVisible();
    expect(
      callsTo(calls, '/request-password-reset')[0]?.postDataJSON(),
    ).toEqual({ email: 'ada@example.com' });

    const code = page.getByLabel(forgotPassword.reset.codeLabel);
    const password = page.getByLabel(forgotPassword.reset.passwordLabel, {
      exact: true,
    });
    const submit = page.getByRole('button', {
      name: forgotPassword.reset.submit,
    });
    await expect(submit).toBeDisabled();
    await code.pressSequentially(WRONG_OTP);
    await password.fill('new-analytical-1843');
    await submit.click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(
      authErrors.INVALID_OTP,
    );
    await expect(code).toHaveValue('');
    await expect(password).toHaveValue('new-analytical-1843');

    await code.pressSequentially(RIGHT_OTP);
    await submit.click();

    await expect(page).toHaveURL(
      /\/en\/sign-in\?reset=1&redirectTo=%2Fme%2Fedit$/,
    );
    expect(callsTo(calls, '/reset-password').at(-1)?.postDataJSON()).toEqual({
      email: 'ada@example.com',
      otp: RIGHT_OTP,
      password: 'new-analytical-1843',
    });
  });

  test('validates the email before calling the API', async ({ page }) => {
    const calls = await mockResetApi(page);
    await page.goto('/en/forgot-password');

    const email = page.getByLabel(auth.fields.email.label);
    await email.fill('not-an-email');
    await email.press('Enter');

    await expect(
      page.getByText(auth.fields.email.errors.invalid),
    ).toBeVisible();
    expect(callsTo(calls, '/request-password-reset')).toHaveLength(0);
  });

  test('validates the new password before calling the API', async ({
    page,
  }) => {
    const calls = await mockResetApi(page);
    await page.goto('/en/forgot-password/reset?email=ada%40example.com');

    await page
      .getByLabel(forgotPassword.reset.codeLabel)
      .pressSequentially(RIGHT_OTP);
    await page
      .getByLabel(forgotPassword.reset.passwordLabel, { exact: true })
      .fill('123');
    await page
      .getByRole('button', { name: forgotPassword.reset.submit })
      .click();

    await expect(
      page.getByText(auth.fields.password.errors.tooShort),
    ).toBeVisible();
    expect(callsTo(calls, '/reset-password')).toHaveLength(0);
  });

  test('shows a translated message when the API fails', async ({ page }) => {
    await mockAuthApi(page, {
      overrides: {
        '/email-otp/request-password-reset': () => ({
          status: 429,
          body: { message: 'Slow down' },
        }),
      },
    });
    await page.goto('/pt-BR/forgot-password');
    const pt = messages['pt-BR'];

    await page.getByLabel(pt.auth.fields.email.label).fill('ada@example.com');
    await page
      .getByRole('button', { name: pt.auth.forgotPassword.request.submit })
      .click();

    await expect(page.getByRole('main').getByRole('alert')).toHaveText(
      pt.authErrors.RATE_LIMITED,
    );
    await expect(page).toHaveURL(/\/pt-BR\/forgot-password$/);
  });

  test('resends the code after the cooldown', async ({ page }) => {
    const calls = await mockResetApi(page);
    // The last reset code was sent two minutes ago; a verification code
    // sent just now has a cooldown of its own.
    await page.addInitScript((key) => {
      localStorage.setItem(key, String(Date.now() - 120_000));
      localStorage.setItem(
        'notefinder:otp-sent-at:ada@example.com',
        String(Date.now()),
      );
    }, RESET_SENT_AT_KEY);
    await page.goto('/en/forgot-password/reset?email=ada%40example.com');

    await page
      .getByRole('button', { name: auth.verifyEmail.resend, exact: true })
      .click();

    await expect(page.getByRole('main').getByRole('status')).toHaveText(
      forgotPassword.reset.resent,
    );
    expect(
      callsTo(calls, '/request-password-reset')[0]?.postDataJSON(),
    ).toEqual({ email: 'ada@example.com' });
    expect(callsTo(calls, '/send-verification-otp')).toHaveLength(0);
    await expect(
      page.getByRole('button', { name: /Resend code in \d+s/ }),
    ).toBeDisabled();
  });

  test('asks for a code when the email is missing', async ({ page }) => {
    await page.goto('/en/forgot-password/reset?redirectTo=%2Fme%2Fedit');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: forgotPassword.reset.missing.title,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: forgotPassword.reset.missing.cta }),
    ).toHaveAttribute('href', '/en/forgot-password?redirectTo=%2Fme%2Fedit');
  });
});

import { expect, type Page, test } from '@playwright/test';

import { ADA, type MockUser, mockAuthApi } from './auth-api-mock';
import { messages } from './messages';

const { auth, authErrors } = messages.en;
const ADA_WITH_USERNAME: MockUser = { ...ADA, username: 'ada' };
// The link text inside the `<link>` tag of the rich message.
const signUpLabel = /<link>(.*)<\/link>/.exec(auth.signIn.noAccount)?.[1] ?? '';

/**
 * Sign-in endpoints that accept any credentials and sign `user` in, with the
 * session following them (signed out until then).
 */
function signInApi(user: MockUser) {
  let signedIn = false;
  const signIn = () => {
    signedIn = true;
    return { body: { redirect: false, token: 'token', user } };
  };
  return {
    '/sign-in/email': signIn,
    '/sign-in/username': signIn,
    '/get-session': () => ({
      body: signedIn ? { session: { id: 'ses_1' }, user } : null,
    }),
  };
}

const failWith = (status: number, code: string) => () => ({
  status,
  body: { code, message: code },
});

async function fillSignIn(page: Page, emailOrUsername: string) {
  await page
    .getByLabel(auth.signIn.emailOrUsername.label)
    .fill(emailOrUsername);
  await page
    .getByLabel(auth.fields.password.label, { exact: true })
    .fill('analytical-1843');
  await page.getByRole('button', { name: auth.signIn.submit }).click();
}

test.describe('sign-in', () => {
  test('signs in by username and continues to redirectTo', async ({ page }) => {
    const calls = await mockAuthApi(page, {
      overrides: signInApi(ADA_WITH_USERNAME),
    });
    await page.goto('/en/sign-in?redirectTo=%2F%3Ffrom%3Dsign-in');

    await fillSignIn(page, 'Ada');

    await expect(page).toHaveURL(/\/en\?from=sign-in$/);
    const signIn = calls.find((call) =>
      call.url().endsWith('/sign-in/username'),
    );
    expect(signIn?.postDataJSON()).toMatchObject({
      username: 'Ada',
      password: 'analytical-1843',
    });
  });

  test('signs in by email; the gate asks for a missing username', async ({
    page,
  }) => {
    const calls = await mockAuthApi(page, { overrides: signInApi(ADA) });
    await page.goto('/en/sign-in?redirectTo=%2F%3Ffrom%3Dsign-in');

    await fillSignIn(page, 'ada@example.com');

    await expect(page).toHaveURL(
      /\/en\/setup-username\?redirectTo=%2F%3Ffrom%3Dsign-in$/,
    );
    const signIn = calls.find((call) => call.url().endsWith('/sign-in/email'));
    expect(signIn?.postDataJSON()).toMatchObject({
      email: 'ada@example.com',
      password: 'analytical-1843',
    });
  });

  test('shows wrong credentials translated', async ({ page }) => {
    await mockAuthApi(page, {
      overrides: {
        '/sign-in/email': failWith(401, 'INVALID_EMAIL_OR_PASSWORD'),
      },
    });
    await page.goto('/pt-BR/sign-in');
    const pt = messages['pt-BR'];

    await page
      .getByLabel(pt.auth.signIn.emailOrUsername.label)
      .fill('ada@example.com');
    await page
      .getByLabel(pt.auth.fields.password.label, { exact: true })
      .fill('wrong-password');
    await page.getByRole('button', { name: pt.auth.signIn.submit }).click();

    await expect(page.getByRole('main').getByRole('alert')).toHaveText(
      pt.authErrors.INVALID_EMAIL_OR_PASSWORD,
    );
    await expect(page).toHaveURL(/\/pt-BR\/sign-in$/);
  });

  test('sends an unverified email to verify it, with the code just sent', async ({
    page,
  }) => {
    await mockAuthApi(page, {
      overrides: { '/sign-in/email': failWith(403, 'EMAIL_NOT_VERIFIED') },
    });
    await page.goto('/en/sign-in?redirectTo=%2Fme%2Fedit');

    await fillSignIn(page, 'ada@example.com');

    await expect(page).toHaveURL(
      /\/en\/verify-email\?email=ada%40example\.com&redirectTo=%2Fme%2Fedit$/,
    );
    // The resend cooldown counts from this sign-in.
    await expect(
      page.getByRole('button', { name: /Resend code in \d+s/ }),
    ).toBeDisabled();
  });

  test('explains an unverified email when signing in by username', async ({
    page,
  }) => {
    await mockAuthApi(page, {
      overrides: { '/sign-in/username': failWith(403, 'EMAIL_NOT_VERIFIED') },
    });
    await page.goto('/en/sign-in');

    await fillSignIn(page, 'ada');

    await expect(page.getByRole('main').getByRole('alert')).toHaveText(
      authErrors.EMAIL_NOT_VERIFIED,
    );
    await expect(page).toHaveURL(/\/en\/sign-in$/);
  });

  test('requires both fields before calling the API', async ({ page }) => {
    const calls = await mockAuthApi(page);
    await page.goto('/en/sign-in');

    await page.getByRole('button', { name: auth.signIn.submit }).click();

    await expect(
      page.getByText(auth.signIn.emailOrUsername.required),
    ).toBeVisible();
    await expect(page.getByText(auth.signIn.password.required)).toBeVisible();
    expect(calls.filter((call) => call.url().includes('/sign-in/'))).toEqual(
      [],
    );
  });

  test('links to sign-up and password reset keeping redirectTo', async ({
    page,
  }) => {
    await mockAuthApi(page);
    await page.goto('/en/sign-in?redirectTo=%2Fme%2Fedit');

    await expect(page.getByRole('link', { name: signUpLabel })).toHaveAttribute(
      'href',
      '/en/sign-up?redirectTo=%2Fme%2Fedit',
    );
    await expect(
      page.getByRole('link', { name: auth.signIn.forgotPassword }),
    ).toHaveAttribute('href', '/en/forgot-password?redirectTo=%2Fme%2Fedit');
  });

  test('brings failed Google sign-ins back here', async ({ page, baseURL }) => {
    const calls = await mockAuthApi(page, {
      overrides: { '/sign-in/social': () => ({ status: 500, body: {} }) },
    });
    await page.goto('/en/sign-in?redirectTo=%2Fme%2Fedit');

    await page.getByRole('button', { name: auth.signUp.google }).click();

    await expect(page.getByRole('main').getByRole('alert')).toHaveText(
      auth.signUp.googleError,
    );
    const social = calls.find((call) => call.url().endsWith('/sign-in/social'));
    expect(social?.postDataJSON()).toMatchObject({
      callbackURL: `${baseURL}/en/me/edit`,
      errorCallbackURL: `${baseURL}/en/sign-in?redirectTo=%2Fme%2Fedit`,
    });
  });

  test('shows the Google error it was sent back with', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/en/sign-in?error=access_denied');

    await expect(page.getByRole('main').getByRole('alert')).toHaveText(
      auth.signUp.googleError,
    );
  });

  test('confirms a password reset, until an attempt fails', async ({
    page,
  }) => {
    await mockAuthApi(page, {
      overrides: {
        '/sign-in/email': failWith(401, 'INVALID_EMAIL_OR_PASSWORD'),
      },
    });
    await page.goto('/en/sign-in?reset=1');

    const main = page.getByRole('main');
    await expect(main.getByRole('status')).toHaveText(
      auth.signIn.passwordReset,
    );

    await fillSignIn(page, 'ada@example.com');

    await expect(main.getByRole('alert')).toHaveText(
      authErrors.INVALID_EMAIL_OR_PASSWORD,
    );
    await expect(main.getByRole('status')).toHaveCount(0);
  });

  test('sends a signed-in visitor on to redirectTo', async ({ page }) => {
    await mockAuthApi(page, { user: ADA_WITH_USERNAME });
    await page.goto('/en/sign-in?redirectTo=%2F%3Ffrom%3Dsign-in');

    await expect(page).toHaveURL(/\/en\?from=sign-in$/);
  });
});

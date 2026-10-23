import { expect, type Page, test } from '@playwright/test';

import { messages } from './messages';

const user = {
  id: 'usr_google',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  emailVerified: true,
  username: null,
  image: null,
};

type MockState = { signedIn: boolean };
type MockReply = { status?: number; body: unknown };

function mockReply(
  path: string,
  request: import('@playwright/test').Request,
  state: MockState,
  requests: { url: string; body: Record<string, unknown> }[],
): MockReply {
  switch (path) {
    case '/auth/get-session':
      return {
        body: state.signedIn ? { session: { id: 'ses_google' }, user } : null,
      };
    case '/auth/sign-in/social': {
      state.signedIn = true;
      const input = request.postDataJSON() as Record<string, unknown>;
      return { body: { url: input.newUserCallbackURL, redirect: true } };
    }
    case '/auth/sign-up/email':
      return { body: { token: null, user } };
    case '/auth/email-otp/verify-email':
      state.signedIn = true;
      return { body: { status: true, token: 'email-token', user } };
    case '/me/acquisition':
      requests.push({ url: request.url(), body: request.postDataJSON() });
      return { status: 201, body: { recorded: true } };
    default:
      return { status: 404, body: {} };
  }
}

async function mockApi(page: Page) {
  const state: MockState = { signedIn: false };
  const requests: { url: string; body: Record<string, unknown> }[] = [];

  await page.route('**/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const origin = request.headers().origin ?? '*';
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'content-type',
          'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
        },
      });
      return;
    }

    const reply = mockReply(
      url.pathname.replace(/^\/v1/, ''),
      request,
      state,
      requests,
    );

    await route.fulfill({
      status: reply.status ?? 200,
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
        'content-type': 'application/json',
      },
      body: JSON.stringify(reply.body),
    });
  });

  return requests;
}

const expectAcquisition = async (
  requests: { body: Record<string, unknown> }[],
) => {
  await expect.poll(() => requests.length).toBe(1);
  const payload = requests[0]?.body;
  expect(payload).toMatchObject({
    firstTouch: {
      utmSource: 'paid-search',
      gclid: 'click-1',
      landingPath: '/en/sign-up',
    },
    lastTouch: {
      utmSource: 'paid-search',
      gclid: 'click-1',
      landingPath: '/en/sign-up',
    },
  });
  expect(payload).not.toHaveProperty('firstTouch.email');
  expect(payload?.visitorId).toEqual(expect.any(String));
};

test('attaches campaign touches after the mocked Google sign-up redirect', async ({
  page,
  baseURL,
}) => {
  const requests = await mockApi(page);

  await page.goto(
    '/en/sign-up?utm_source=paid-search&gclid=click-1&email=discard-me',
  );
  await page
    .getByRole('button', { name: messages.en.auth.signUp.google })
    .click();
  await expect(page).toHaveURL(`${baseURL}/en/setup-username`);

  await expectAcquisition(requests);
});

test('attaches campaign touches after email verification signs the user in', async ({
  page,
}) => {
  const requests = await mockApi(page);
  await page.goto(
    '/en/sign-up?utm_source=paid-search&gclid=click-1&email=discard-me',
  );
  const auth = messages.en.auth;
  await page.getByLabel(auth.fields.name.label).fill('Ada Lovelace');
  await page.getByLabel(auth.fields.email.label).fill('ada@example.com');
  await page
    .getByLabel(auth.fields.password.label, { exact: true })
    .fill('analytical-1843');
  await page.getByRole('button', { name: auth.signUp.submit }).click();
  await expect(page).toHaveURL(/\/en\/verify-email\?/);
  await page.getByLabel(auth.verifyEmail.codeLabel).pressSequentially('424242');

  await expect(page).toHaveURL(/\/en\/setup-username/);
  await expectAcquisition(requests);
});

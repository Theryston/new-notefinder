import { expect, test } from '@playwright/test';

import { ADA, mockAuthApi } from './auth-api-mock';
import { setTrackMock } from './fake-track-api';
import { messages } from './messages';

test('waits for an anonymous view across sign-in before attaching its ID', async ({
  page,
}) => {
  const trackId = 'clx-view-pending-sign-in';
  const user = { ...ADA, username: 'ada_singer' };
  let signedIn = false;
  await mockAuthApi(page, {
    overrides: {
      '/sign-in/email': () => {
        signedIn = true;
        return { body: { redirect: false, token: 'token', user } };
      },
      '/get-session': () => ({
        body: signedIn ? { session: { id: 'ses_1' }, user } : null,
      }),
    },
  });
  let release = () => {};
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const posts: unknown[] = [];
  await page.route('**/v1/tracks/*/views', async (route) => {
    const headers = {
      'access-control-allow-origin': route.request().headers().origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    posts.push(route.request().postDataJSON());
    if (posts.length === 1) await waiting;
    await route.fulfill({
      status: posts.length === 1 ? 201 : 200,
      headers,
      json: { viewId: 'pending-view' },
    });
  });
  await setTrackMock({
    tracks: [
      {
        id: trackId,
        title: 'Pending visit',
        processing: { status: 'COMPLETED' },
      },
    ],
  });
  await page.addInitScript(() =>
    localStorage.setItem('notefinder:visitor-id', 'pending-view-visitor'),
  );
  await page.goto(`/en/tracks/${trackId}`);
  await expect.poll(() => posts.length).toBe(1);
  await page
    .getByRole('link', { name: messages.en.tracks.practice.favorite.signIn })
    .click();
  await page
    .getByLabel(messages.en.auth.signIn.emailOrUsername.label)
    .fill(user.email);
  await page
    .getByLabel(messages.en.auth.fields.password.label, { exact: true })
    .fill('analytical-1843');
  await page
    .getByRole('button', { name: messages.en.auth.signIn.submit })
    .click();
  await expect(page).toHaveURL(`/en/tracks/${trackId}`);
  await expect(
    page.getByRole('heading', { name: 'Pending visit' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: messages.en.header.account.accountMenu }),
  ).toBeVisible();
  release();
  await expect.poll(() => posts.length).toBe(2);
  expect(posts).toEqual([
    { locale: 'en', visitorId: 'pending-view-visitor' },
    { viewId: 'pending-view', visitorId: 'pending-view-visitor' },
  ]);
});

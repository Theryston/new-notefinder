import { expect, type Page, test } from '@playwright/test';

import { mockAttemptsApi } from './attempts-api-mock';
import { ADA, mockAuthApi } from './auth-api-mock';
import { type FakeTrack, setTrackMock } from './fake-track-api';
import { messages as catalogs } from './messages';

const SINGER = { ...ADA, username: 'ada_singer' };

const track = (id: string): FakeTrack => ({
  id,
  title: 'Preferences practice',
  durationMs: 12000,
  youtubeVideoId: 'dQw4w9WgXcQ',
  processing: { status: 'COMPLETED' },
  notes: [{ pitch: 69, start: 1, end: 2 }],
});

async function openTrack(page: Page, id: string, locale: string) {
  await setTrackMock({ tracks: [track(id)] });
  await page.goto(`/${locale}/tracks/${id}`);
}

const settings = (page: Page, t: (typeof catalogs)['en']) =>
  page.getByRole('button', {
    name: t.tracks.practice.dock.settings,
    exact: true,
  });

const difficulty = (page: Page, name: string) =>
  page.getByRole('menuitemradio', { name, exact: true });

test.describe('practice preferences', () => {
  test('a signed-in User change is patched, and a reload adopts the account', async ({
    page,
  }) => {
    const t = catalogs.en;
    await mockAuthApi(page, { user: SINGER });
    const api = await mockAttemptsApi(page);
    const trackId = 'clx-preferences-account';
    await openTrack(page, trackId, 'en');

    await settings(page, t).click();
    await difficulty(page, t.practice.scoring.HARD).click();
    await expect.poll(() => api.patches).toEqual([{ difficulty: 'HARD' }]);
    await page.keyboard.press('Escape');

    // The device copy says otherwise now, so the reload must read the
    // account to keep showing HARD.
    await page.evaluate(() =>
      localStorage.setItem(
        'vozzify.scoring.v1',
        JSON.stringify({ difficulty: 'NORMAL', octaveMode: 'ANY' }),
      ),
    );
    await page.reload();
    await settings(page, t).click();
    await expect(difficulty(page, t.practice.scoring.HARD)).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('a visitor change stays on the device and never reaches the account', async ({
    page,
  }) => {
    const t = catalogs.en;
    await mockAuthApi(page);
    const api = await mockAttemptsApi(page);
    await openTrack(page, 'clx-preferences-device', 'en');

    await settings(page, t).click();
    await difficulty(page, t.practice.scoring.HARD).click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    expect(api.patches).toEqual([]);

    await page.reload();
    await settings(page, t).click();
    await expect(difficulty(page, t.practice.scoring.HARD)).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('signing in adopts the account values over the device ones', async ({
    page,
  }) => {
    const t = catalogs.en;
    let signedIn = false;
    await mockAuthApi(page, {
      overrides: {
        '/sign-in/email': () => {
          signedIn = true;
          return { body: { redirect: false, token: 'token', user: SINGER } };
        },
        '/get-session': () => ({
          body: signedIn ? { session: { id: 'ses_1' }, user: SINGER } : null,
        }),
      },
    });
    const api = await mockAttemptsApi(page, {
      preferences: { difficulty: 'HARD' },
    });
    const trackId = 'clx-preferences-adopt';
    await openTrack(page, trackId, 'en');

    // A visitor's pick, kept on the device: EASY, against the account's HARD.
    await settings(page, t).click();
    await difficulty(page, t.practice.scoring.EASY).click();
    await page.keyboard.press('Escape');
    await settings(page, t).click();
    await expect(difficulty(page, t.practice.scoring.EASY)).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.keyboard.press('Escape');
    expect(api.patches).toEqual([]);

    await page.goto(
      `/en/sign-in?redirectTo=${encodeURIComponent(`/tracks/${trackId}`)}`,
    );
    await page
      .getByLabel(t.auth.signIn.emailOrUsername.label)
      .fill(SINGER.email);
    await page
      .getByLabel(t.auth.fields.password.label, { exact: true })
      .fill('analytical-1843');
    await page.getByRole('button', { name: t.auth.signIn.submit }).click();

    await expect(page).toHaveURL(`/en/tracks/${trackId}`);
    await settings(page, t).click();
    await expect(difficulty(page, t.practice.scoring.HARD)).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});

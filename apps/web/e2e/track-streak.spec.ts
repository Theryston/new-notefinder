import { expect, type Page, test } from '@playwright/test';

import { ADA, mockAuthApi } from './auth-api-mock';
import { type FakeTrack, setTrackMock } from './fake-track-api';
import { messages as catalogs } from './messages';
import { mockStreakApi } from './streak-api-mock';

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;

const BROWSER_TIME_ZONE = 'America/Sao_Paulo';

const SINGER = { ...ADA, username: 'ada_singer' };

const track = (id: string): FakeTrack => ({
  id,
  title: 'Under Pressure',
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  durationMs: 248_000,
  youtubeVideoId: 'dQw4w9WgXcQ',
  processing: { status: 'COMPLETED' },
  notes: [{ pitch: 64, start: 2, end: 3 }],
  contributors: [],
});

async function openTrack(page: Page, locale: string, id: string) {
  await setTrackMock({ tracks: [track(id)] });
  await page.goto(`/${locale}/tracks/${id}`);
}

/** Pretends the tab went to the background, as it does when the page closes. */
function hidePage(page: Page) {
  return page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

for (const { locale, messages } of cases) {
  const { dock, streak } = messages.tracks.practice;

  test.describe(`daily practice streak (${locale})`, () => {
    // The practice day follows the browser's zone, which heartbeats send.
    test.use({ timezoneId: BROWSER_TIME_ZONE });

    test('the ring advances while the music plays and stands still when paused', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: SINGER });
      const api = await mockStreakApi(page);
      await openTrack(page, locale, `clx-streak-ring-${locale}`);
      const ring = page.getByRole('button', { name: /%/ });
      await expect(ring).toHaveAttribute('data-progress', '0');

      await page.getByRole('button', { name: dock.play }).click();

      await expect
        .poll(async () => Number(await ring.getAttribute('data-progress')), {
          timeout: 15_000,
        })
        .toBeGreaterThan(0);
      expect(api.heartbeats[0]).toMatchObject({
        timeZone: BROWSER_TIME_ZONE,
      });
      await page.getByRole('button', { name: dock.pause }).click();
      await page.waitForTimeout(500);
      const sent = api.heartbeats.length;
      await page.waitForTimeout(6_000);
      expect(api.heartbeats.length).toBeLessThanOrEqual(sent + 1);
    });

    test('flushes the pending seconds with a beacon when the page is hidden', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: SINGER });
      const api = await mockStreakApi(page);
      await openTrack(page, locale, `clx-streak-beacon-${locale}`);
      await expect(page.getByRole('button', { name: /%/ })).toBeVisible();
      await page.getByRole('button', { name: dock.play }).click();
      await page.waitForTimeout(2_500);

      await hidePage(page);

      await expect.poll(() => api.heartbeats.length).toBe(1);
      expect(api.heartbeats[0]?.elapsedSeconds).toBeGreaterThanOrEqual(2);
      expect(api.heartbeats[0]?.elapsedSeconds).toBeLessThan(5);
    });

    test('tapping the ring shows the streak and the time left today', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: SINGER });
      await mockStreakApi(page, {
        targetSeconds: 300,
        listenedSeconds: 30,
        streakDays: 4,
      });
      await openTrack(page, locale, `clx-streak-popover-${locale}`);

      await page.getByRole('button', { name: /%/ }).click();

      await expect(page.getByText(/4 (day|dias)/)).toBeVisible();
      await expect(page.getByText(/4 min 30/)).toBeVisible();
      await expect(
        page.getByText(streak.countsWhilePlaying, { exact: false }),
      ).toBeVisible();
    });

    test('celebrates when the daily target is reached', async ({ page }) => {
      await mockAuthApi(page, { user: SINGER });
      await mockStreakApi(page, {
        targetSeconds: 300,
        listenedSeconds: 297,
        streakDays: 2,
      });
      await openTrack(page, locale, `clx-streak-goal-${locale}`);
      await expect(page.getByRole('button', { name: /%/ })).toBeVisible();

      await page.getByRole('button', { name: dock.play }).click();

      const toast = page.getByTestId('streak-celebration');
      await expect(toast).toBeVisible({ timeout: 15_000 });
      await expect(toast).toContainText(streak.celebrationTitle);
      await expect(page.getByTestId('streak-confetti')).toBeAttached();
    });

    test('a visitor sees the ring invite them to create an account', async ({
      page,
    }) => {
      await mockAuthApi(page);
      const trackId = `clx-streak-visitor-${locale}`;
      await openTrack(page, locale, trackId);

      await page.getByRole('button', { name: streak.inviteRing }).click();

      await expect(page.getByText(streak.inviteTitle)).toBeVisible();
      const create = page.getByRole('link', { name: streak.inviteCreate });
      await expect(create).toHaveAttribute(
        'href',
        `/${locale}/sign-up?redirectTo=${encodeURIComponent(`/tracks/${trackId}`)}`,
      );
    });
  });
}

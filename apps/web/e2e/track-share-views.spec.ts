import { expect, test } from '@playwright/test';
import { createTranslator } from 'next-intl';

import { setTrackMock } from './fake-track-api';
import { messages as catalogs } from './messages';

const track = (id: string) => ({
  id,
  title: 'Under Pressure',
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  durationMs: 248_000,
  youtubeVideoId: 'a01QQZyl-_I',
  notes: [{ pitch: 60, start: 0, end: 1 }],
  processing: { status: 'COMPLETED' },
});

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;
const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 390, height: 844 },
] as const;

for (const { locale, messages } of cases) {
  const t = createTranslator({
    locale,
    messages,
    namespace: 'tracks.practice.share',
  });
  for (const viewport of viewports) {
    test(`shares a copyable moment link on ${viewport.name} (${locale})`, async ({
      page,
      context,
    }) => {
      const trackId = `clx-share-${locale}-${viewport.name}`;
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await setTrackMock({ tracks: [track(trackId)] });
      await page.goto(`/${locale}/tracks/${trackId}`);
      await page.getByRole('button', { name: t('action') }).click();

      const link = page.getByLabel(t('linkLabel'));
      await expect(link).toHaveValue(/[?&]time=\d+/);
      await expect(
        page.getByRole('link', { name: t('networks.whatsapp') }),
      ).toBeVisible();
      await page.getByRole('button', { name: t('copy') }).click();
      await expect
        .poll(() =>
          context.pages()[0]?.evaluate(() => navigator.clipboard.readText()),
        )
        .toMatch(/[?&]time=\d+/);

      await page.getByRole('checkbox', { name: t('includeMoment') }).uncheck();
      await expect(link).not.toHaveValue(/[?&]time=/);
      await page.getByRole('button', { name: t('copy') }).click();
      await expect
        .poll(() =>
          context.pages()[0]?.evaluate(() => navigator.clipboard.readText()),
        )
        .not.toMatch(/[?&]time=/);
    });
  }
}

test('records a Track once in the browser session', async ({ page }) => {
  const trackId = 'clx-view-once';
  let posted = 0;
  await setTrackMock({ tracks: [track(trackId)] });
  await page.route(`**/v1/tracks/${trackId}/views`, async (route) => {
    posted += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ viewId: 'session-view-1' }),
    });
  });
  await page.goto(`/en/tracks/${trackId}`);
  await expect
    .poll(() =>
      page.evaluate(() =>
        sessionStorage.getItem('notefinder:track-view:clx-view-once'),
      ),
    )
    .toBe('session-view-1');
  await page.goto(`/en/tracks/${trackId}`);
  await expect.poll(() => posted).toBe(1);
});

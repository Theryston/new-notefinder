import { expect, test } from '@playwright/test';

import { setTrackMock } from './fake-track-api';
import { messages } from './messages';

test('shares the new moment when the dialog is reopened after seeking', async ({
  page,
  baseURL,
}) => {
  const trackId = 'clx-share-reopen';
  const { share, dock } = messages.en.tracks.practice;
  await setTrackMock({
    tracks: [
      {
        id: trackId,
        title: 'Share again',
        artistCredit: [],
        durationMs: 120_000,
        youtubeVideoId: 'dQw4w9WgXcQ',
        processing: { status: 'COMPLETED' },
        notes: [{ pitch: 64, start: 2, end: 3 }],
        contributors: [],
      },
    ],
  });
  await page.goto(`/en/tracks/${trackId}`);
  await expect(page.getByRole('button', { name: dock.play })).toBeEnabled();
  await page.getByRole('button', { name: share.open }).click();
  await expect(page.getByLabel(share.link)).toHaveValue(
    `${baseURL}/en/tracks/${trackId}`,
  );
  await page.getByRole('button', { name: share.close }).click();
  await page.locator('main').click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: share.open }).click();
  await expect(page.getByLabel(share.link)).toHaveValue(
    `${baseURL}/en/tracks/${trackId}?time=5`,
  );
});

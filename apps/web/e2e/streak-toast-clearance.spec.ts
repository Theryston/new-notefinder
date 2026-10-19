import { expect, test } from '@playwright/test';

import { ADA, mockAuthApi } from './auth-api-mock';
import { setTrackMock } from './fake-track-api';
import { messages } from './messages';
import { turnMicOn } from './sing-with-fake-mic';
import { mockStreakApi } from './streak-api-mock';

for (const width of [360, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`streak celebration clearance (${width}px, ${theme})`, () => {
      test.use({
        viewport: { width, height: 1000 },
        colorScheme: theme,
        permissions: ['microphone'],
      });

      test('keeps the entire milestone toast above the practice dock', async ({
        page,
      }) => {
        await page.addInitScript(
          (value) => localStorage.setItem('theme', value),
          theme,
        );
        await mockAuthApi(page, { user: { ...ADA, username: 'ada_singer' } });
        await mockStreakApi(page, { listenedSeconds: 297, streakDays: 2 });
        const id = `clx-toast-clearance-${width}-${theme}`;
        await setTrackMock({
          tracks: [
            {
              id,
              title: 'Under Pressure',
              artistCredit: [{ name: 'Queen', joinPhrase: '' }],
              durationMs: 248_000,
              youtubeVideoId: 'dQw4w9WgXcQ',
              processing: { status: 'COMPLETED' },
              notes: [{ pitch: 64, start: 2, end: 3 }],
              contributors: [],
            },
          ],
        });
        await page.goto(`/en/tracks/${id}`);
        await expect(page.getByRole('button', { name: /%/ })).toBeVisible();
        await turnMicOn(page, messages.en.practice.mic);
        await page
          .getByRole('button', { name: messages.en.tracks.practice.dock.play })
          .click();
        const celebration = page.getByTestId('streak-celebration');
        await expect(celebration).toBeVisible({ timeout: 15_000 });
        const dock = page.getByRole('region', {
          name: messages.en.tracks.practice.dock.label,
        });
        await expect
          .poll(async () => {
            const [toastBox, dockBox] = await Promise.all([
              celebration.boundingBox(),
              dock.boundingBox(),
            ]);
            if (toastBox === null || dockBox === null) return false;
            return (
              toastBox.y >= 0 && toastBox.y + toastBox.height <= dockBox.y - 8
            );
          })
          .toBe(true);
      });
    });
  }
}

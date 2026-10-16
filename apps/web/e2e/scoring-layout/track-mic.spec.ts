import { expect, type Page, test } from '@playwright/test';
import { setTrackMock } from '../fake-track-api';
import { messages } from '../messages';

test.use({ permissions: ['microphone'] });

async function clearance(page: Page, label: string) {
  const canvas = await page.locator('canvas').boundingBox();
  const dock = await page.getByRole('region', { name: label }).boundingBox();
  return canvas && dock
    ? dock.y - canvas.y - canvas.height
    : Number.NEGATIVE_INFINITY;
}

for (const locale of ['en', 'pt-BR'] as const) {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 360, height: 900 },
  ]) {
    test(`${locale}: live scoring keeps the timeline clear of the dock at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const t = messages[locale];
      const id = `scoring-clearance-${locale}-${viewport.width}`;
      await setTrackMock({
        tracks: [
          {
            id,
            title: 'Practice',
            durationMs: 60000,
            youtubeVideoId: 'dQw4w9WgXcQ',
            processing: { status: 'COMPLETED' },
            notes: [{ pitch: 69, start: 0, end: 60 }],
          },
        ],
      });
      await page.goto(`/${locale}/tracks/${id}`);
      await expect(
        page.getByRole('button', {
          name: t.tracks.practice.dock.play,
          exact: true,
        }),
      ).toBeEnabled();
      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible();
      const listenHeight = (await canvas.boundingBox())?.height;
      await page
        .getByRole('button', { name: t.practice.mic.on, exact: true })
        .click();
      await expect(page.getByTestId('score-readout')).toBeVisible();
      await expect
        .poll(() => clearance(page, t.tracks.practice.dock.label))
        .toBeGreaterThanOrEqual(8);
      await page
        .getByRole('button', { name: t.practice.mic.off, exact: true })
        .click();
      await expect(page.getByTestId('score-readout')).toHaveCount(0);
      await expect
        .poll(async () => (await canvas.boundingBox())?.height)
        .toBe(listenHeight);
    });
  }
}

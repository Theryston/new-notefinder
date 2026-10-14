import { expect, type Page, test } from '@playwright/test';

import { type FakeTrack, setTrackMock } from './fake-track-api';
import { messages as catalogs } from './messages';

// Chromium's fake microphone "sings" e2e/fixtures/a4-440hz.wav in a loop (the
// launch flags are in playwright.config.ts): a 440 Hz voice with harmonics,
// which is an A4.
test.use({ permissions: ['microphone'], colorScheme: 'light' });

/** A completed Track with a few notes, unless the overrides say otherwise. */
const completedTrack = (
  id: string,
  overrides: Partial<FakeTrack> = {},
): FakeTrack => ({
  id,
  title: 'Under Pressure',
  durationMs: 248_000,
  youtubeVideoId: 'dQw4w9WgXcQ',
  processing: { status: 'COMPLETED' },
  notes: [
    { pitch: 64, start: 2, end: 3 },
    { pitch: 67, start: 3.5, end: 5 },
  ],
  ...overrides,
});

/** Notes held on A4 for the whole test, so the target is the fake voice. */
const SUNG_A4 = [
  { pitch: 69, start: 0, end: 600 },
  { pitch: 71, start: 601, end: 700 },
];

/**
 * How many pixels of the roll, left of the playhead and clear of the lane
 * labels, are as dark as the voice line is on the light theme. Notes and
 * lanes are never that dark in either mode there, so only the voice is.
 */
function voicePixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return 0;
    const scale = canvas.width / canvas.getBoundingClientRect().width;
    const left = Math.round(52 * scale);
    const right = Math.round(canvas.width * 0.4 - 8 * scale);
    const data = ctx.getImageData(left, 0, right - left, canvas.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r = 255, g = 255, b = 255, a = 0] = data.slice(i, i + 4);
      if (a === 255 && r < 60 && g < 60 && b < 60) count += 1;
    }
    return count;
  });
}

/** Serves a completed Track and opens its page. */
async function openTrack(
  page: Page,
  {
    locale,
    id,
    notes,
  }: { locale: string; id: string; notes?: FakeTrack['notes'] },
) {
  await setTrackMock({
    tracks: [completedTrack(id, notes ? { notes } : {})],
  });
  await page.goto(`/${locale}/tracks/${id}`);
}

/** The notice is inside the dock; Next's route announcer is an alert too. */
const dock = (page: Page, label: string) =>
  page.getByRole('region', { name: label });

for (const locale of ['en', 'pt-BR'] as const) {
  const messages = catalogs[locale].tracks.practice;

  test.describe(`track practice page, sing mode (${locale})`, () => {
    test('draws the voice and names the detected note when the mic is on', async ({
      page,
    }) => {
      const trackId = `clx-mic-sing-${locale}`;
      await openTrack(page, { locale, id: trackId, notes: SUNG_A4 });
      const play = page.getByRole('button', { name: messages.dock.play });
      await expect(play).toBeEnabled();
      expect(await voicePixels(page)).toBe(0);

      await page.getByRole('button', { name: messages.mic.on }).click();
      await expect(
        page.getByRole('button', { name: messages.mic.off }),
      ).toHaveAttribute('aria-pressed', 'true');
      await play.click();

      await expect(page.getByTestId('detected-note')).toHaveText('A4');
      await expect(page.getByTestId('target-note')).toHaveText('A4');
      await expect.poll(() => voicePixels(page)).toBeGreaterThan(40);
    });

    test('goes back to listen mode when the mic is turned off', async ({
      page,
    }) => {
      const trackId = `clx-mic-off-${locale}`;
      await openTrack(page, { locale, id: trackId, notes: SUNG_A4 });

      await page.getByRole('button', { name: messages.mic.on }).click();
      await expect(page.getByTestId('detected-note')).toBeVisible();
      await page.getByRole('button', { name: messages.mic.off }).click();

      await expect(page.getByTestId('detected-note')).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: messages.mic.on }),
      ).toHaveAttribute('aria-pressed', 'false');
    });

    test('recommends headphones the first time only', async ({ page }) => {
      const trackId = `clx-mic-tip-${locale}`;
      await openTrack(page, { locale, id: trackId });

      await page.getByRole('button', { name: messages.mic.on }).click();
      await expect(page.getByText(messages.mic.headphonesTip)).toBeVisible();

      await page.getByRole('button', { name: messages.mic.off }).click();
      await page.getByRole('button', { name: messages.mic.on }).click();
      await expect(
        page.getByRole('button', { name: messages.mic.off }),
      ).toBeVisible();
      await expect(page.getByText(messages.mic.headphonesTip)).toHaveCount(0);
    });

    for (const { error, problem } of [
      { error: 'NotAllowedError', problem: 'denied' },
      { error: 'NotFoundError', problem: 'unavailable' },
    ] as const) {
      test(`explains a microphone that fails with ${error}`, async ({
        page,
      }) => {
        await page.addInitScript((name) => {
          navigator.mediaDevices.getUserMedia = () =>
            Promise.reject(new DOMException('refused', name));
        }, error);
        const trackId = `clx-mic-${problem}-${locale}`;
        await openTrack(page, { locale, id: trackId });

        await page.getByRole('button', { name: messages.mic.on }).click();

        await expect(
          dock(page, messages.dock.label).getByRole('alert'),
        ).toHaveText(messages.mic[problem]);
        await expect(
          page.getByRole('button', { name: messages.mic.on }),
        ).toHaveAttribute('aria-pressed', 'false');
        await expect(page.getByTestId('detected-note')).toHaveCount(0);
      });
    }
  });
}

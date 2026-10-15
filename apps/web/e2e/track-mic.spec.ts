import { expect, type Page, test } from '@playwright/test';

import { type FakeTrack, setTrackMock } from './fake-track-api';
import { messages as catalogs } from './messages';

// Chromium's fake microphone "sings" e2e/fixtures/a4-440hz.wav in a loop: a
// 440 Hz voice with harmonics, which is an A4. It is set up by the
// `chromium-mic` project in playwright.config.ts, which only runs this file.
test.use({ permissions: ['microphone'] });

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
 * labels, have exactly the voice line's color (`--timeline-pitch`, which is
 * near black in light and near white in dark). A few note-label pixels may
 * share it; a line drawn across the roll is hundreds.
 */
function voicePixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return 0;
    const probe = document.createElement('canvas').getContext('2d');
    if (!probe) return 0;
    probe.fillStyle = getComputedStyle(canvas)
      .getPropertyValue('--timeline-pitch')
      .trim();
    probe.fillRect(0, 0, 1, 1);
    const [vr = 0, vg = 0, vb = 0] = probe.getImageData(0, 0, 1, 1).data;
    const scale = canvas.width / canvas.getBoundingClientRect().width;
    const left = Math.round(52 * scale);
    const right = Math.round(canvas.width * 0.4 - 8 * scale);
    const data = ctx.getImageData(left, 0, right - left, canvas.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r = 0, g = 0, b = 0, a = 0] = data.slice(i, i + 4);
      const near = (x: number, y: number) => Math.abs(x - y) <= 6;
      if (a === 255 && near(r, vr) && near(g, vg) && near(b, vb)) count += 1;
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

/** The notice's box does not overlap the timeline's box. */
async function expectNoticeBelowTimeline(page: Page) {
  const noticeBox = await page.getByTestId('mic-notice').boundingBox();
  const timelineBox = await page.locator('canvas').boundingBox();
  expect(noticeBox).not.toBeNull();
  expect(timelineBox).not.toBeNull();
  const timelineBottom = (timelineBox?.y ?? 0) + (timelineBox?.height ?? 0);
  expect(noticeBox?.y ?? 0).toBeGreaterThanOrEqual(timelineBottom);
}

for (const locale of ['en', 'pt-BR'] as const) {
  const { mic } = catalogs[locale].practice;
  const { dock: dockMessages } = catalogs[locale].tracks.practice;

  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`sing mode in the ${scheme} theme (${locale})`, () => {
      test.use({ colorScheme: scheme });

      test('draws the voice and names the detected note when the mic is on', async ({
        page,
      }) => {
        const trackId = `clx-mic-sing-${scheme}-${locale}`;
        await openTrack(page, { locale, id: trackId, notes: SUNG_A4 });
        const play = page.getByRole('button', { name: dockMessages.play });
        await expect(play).toBeEnabled();
        expect(await voicePixels(page)).toBeLessThan(60);

        const debug: string[] = [];
        page.on('console', (message) => debug.push(message.text()));
        await page.getByRole('button', { name: mic.on }).click();
        await expect(
          page.getByRole('button', { name: mic.off }),
        ).toHaveAttribute('aria-pressed', 'true');
        await play.click();

        // The ML model takes over from the classic detector once it has
        // loaded, and the note it reads is still the fixture's A4.
        await expect
          .poll(() => debug.some((text) => text.includes('ML model')), {
            timeout: 20_000,
          })
          .toBe(true);
        await expect(page.getByTestId('detected-note')).toHaveText('A4');
        await expect(page.getByTestId('target-note')).toHaveText('A4');
        await expect.poll(() => voicePixels(page)).toBeGreaterThan(200);
      });
    });
  }

  test.describe(`microphone (${locale})`, () => {
    test('goes back to listen mode when the mic is turned off', async ({
      page,
    }) => {
      await openTrack(page, {
        locale,
        id: `clx-mic-off-${locale}`,
        notes: SUNG_A4,
      });

      await page.getByRole('button', { name: mic.on }).click();
      await expect(page.getByTestId('detected-note')).toBeVisible();
      await page.getByRole('button', { name: mic.off }).click();

      await expect(page.getByTestId('detected-note')).toHaveCount(0);
      await expect(page.getByRole('button', { name: mic.on })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    test('recommends headphones the first time only', async ({ page }) => {
      await openTrack(page, { locale, id: `clx-mic-tip-${locale}` });

      await page.getByRole('button', { name: mic.on }).click();
      await expect(page.getByText(mic.headphonesTip)).toBeVisible();

      await page.getByRole('button', { name: mic.off }).click();
      await page.getByRole('button', { name: mic.on }).click();
      await expect(page.getByRole('button', { name: mic.off })).toBeVisible();
      await expect(page.getByText(mic.headphonesTip)).toHaveCount(0);
    });

    test('lets the notice be dismissed with a touch-sized button', async ({
      page,
    }) => {
      await openTrack(page, { locale, id: `clx-mic-dismiss-${locale}` });
      await page.getByRole('button', { name: mic.on }).click();

      const dismiss = page.getByRole('button', { name: mic.dismiss });
      const box = await dismiss.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(40);
      expect(box?.height).toBeGreaterThanOrEqual(40);
      await dismiss.click();
      await expect(page.getByTestId('mic-notice')).toHaveCount(0);
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
        await openTrack(page, { locale, id: `clx-mic-${problem}-${locale}` });

        await page.getByRole('button', { name: mic.on }).click();

        await expect(
          dock(page, dockMessages.label).getByRole('alert'),
        ).toHaveText(mic[problem]);
        await expect(
          page.getByRole('button', { name: mic.on }),
        ).toHaveAttribute('aria-pressed', 'false');
        await expect(page.getByTestId('detected-note')).toHaveCount(0);
      });
    }

    test.describe('on a phone', () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test('keeps the notice clear of the timeline', async ({ page }) => {
        await openTrack(page, {
          locale,
          id: `clx-mic-phone-${locale}`,
          notes: SUNG_A4,
        });
        await page.getByRole('button', { name: mic.on }).click();
        const notice = page.getByTestId('mic-notice');
        await expect(notice).toBeVisible();

        // Where the page opens, and then scrolled to its end: the notice is a
        // row of the dock, never over the timeline.
        await expectNoticeBelowTimeline(page);
        await page.evaluate(() =>
          window.scrollTo(0, document.documentElement.scrollHeight),
        );
        await expectNoticeBelowTimeline(page);
      });
    });
  });
}

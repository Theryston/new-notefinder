import { expect, type Locator, type Page, test } from '@playwright/test';

import { type FakeTrack, setTrackMock } from './fake-track-api';
import { messages } from './messages';

const dock = messages.en.tracks.practice.dock;

const DURATION_SECONDS = 248;
// Pixels the roll moves per second of the Track (timeline-geometry.ts).
const PIXELS_PER_SECOND = 96;

const track = (id: string): FakeTrack => ({
  id,
  title: 'Under Pressure',
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  durationMs: DURATION_SECONDS * 1000,
  youtubeVideoId: 'dQw4w9WgXcQ',
  processing: { status: 'COMPLETED' },
  notes: [
    { pitch: 49, start: 0, end: 1.5 },
    { pitch: 64, start: 2, end: 3 },
    { pitch: 67, start: 3.5, end: 5 },
  ],
  contributors: [],
});

async function openTrack(page: Page, id: string) {
  await setTrackMock({ tracks: [track(id)] });
  await page.goto(`/en/tracks/${id}`);
}

const progress = (page: Page) =>
  page.getByRole('slider', { name: dock.progress });

/** Where the music is, from the progress track, in whole seconds. */
async function playedSeconds(page: Page): Promise<number> {
  const value = await progress(page).getAttribute('aria-valuenow');
  return Number(value);
}

async function readyToPlay(page: Page): Promise<Locator> {
  const play = page.getByRole('button', { name: dock.play });
  await expect(play).toBeEnabled();
  return play;
}

/** Drags from one point of the page to another with the mouse. */
async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('the element has no box');
  return { box, x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('track playback dock', () => {
  test('plays and pauses, loading until the player is ready', async ({
    page,
  }) => {
    await openTrack(page, 'clx-playback-play');
    const play = await readyToPlay(page);

    await play.click();
    await expect.poll(() => playedSeconds(page)).toBeGreaterThanOrEqual(1);
    await page.getByRole('button', { name: dock.pause }).click();

    const paused = await playedSeconds(page);
    await page.waitForTimeout(1300);
    expect(await playedSeconds(page)).toBe(paused);
    await expect(page.getByRole('button', { name: dock.play })).toBeVisible();
  });

  test('plays and pauses with space and skips 5 seconds with the arrows', async ({
    page,
  }) => {
    await openTrack(page, 'clx-playback-keys');
    await readyToPlay(page);
    await page.locator('main').click({ position: { x: 4, y: 4 } });

    await page.keyboard.press('ArrowRight');
    await expect.poll(() => playedSeconds(page)).toBe(5);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => playedSeconds(page)).toBe(10);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => playedSeconds(page)).toBe(5);
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: dock.pause })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: dock.play })).toBeVisible();
  });

  test('seeks by dragging the progress track', async ({ page }) => {
    await openTrack(page, 'clx-playback-progress');
    await readyToPlay(page);
    const { box, y } = await centerOf(progress(page));

    await drag(
      page,
      { x: box.x + box.width * 0.1, y },
      { x: box.x + box.width * 0.5, y },
    );

    await expect
      .poll(() => playedSeconds(page))
      .toBeGreaterThanOrEqual(DURATION_SECONDS / 2 - 2);
    expect(await playedSeconds(page)).toBeLessThanOrEqual(
      DURATION_SECONDS / 2 + 2,
    );
  });

  test('seeks by dragging the timeline', async ({ page }) => {
    await openTrack(page, 'clx-playback-timeline');
    await readyToPlay(page);
    const timeline = page.getByRole('img', { name: /Under Pressure/ });
    const { x, y } = await centerOf(timeline);

    // The roll follows the pointer: dragging left by 8 s of roll goes 8 s on.
    await drag(page, { x, y }, { x: x - PIXELS_PER_SECOND * 8, y });

    await expect.poll(() => playedSeconds(page)).toBe(8);
  });

  test('plays and pauses with space while the progress track is focused', async ({
    page,
  }) => {
    await openTrack(page, 'clx-playback-slider-space');
    await readyToPlay(page);
    await progress(page).focus();

    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: dock.pause })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: dock.play })).toBeVisible();
  });

  test('draws the timeline where the music is', async ({ page }) => {
    await openTrack(page, 'clx-playback-follow');
    await readyToPlay(page);
    const canvas = page.getByRole('img', { name: /Under Pressure/ });
    const readPixels = () =>
      canvas.evaluate((element) => {
        const ctx = (element as HTMLCanvasElement).getContext('2d');
        if (!ctx) return '';
        return ctx
          .getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
          .data.join(',');
      });
    const before = await readPixels();

    await page.getByRole('button', { name: dock.play }).click();

    await expect.poll(readPixels).not.toBe(before);
  });

  test('changes the speed and opens YouTube from the Settings menu', async ({
    page,
  }) => {
    await openTrack(page, 'clx-playback-settings');
    await readyToPlay(page);

    await page.getByRole('button', { name: dock.settings }).click();

    await expect(
      page.getByRole('menuitem', { name: dock.openOnYouTube }),
    ).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.getByRole('menuitemradio', { name: '1.5×' }).click();
    await page.getByRole('button', { name: dock.settings }).click();
    await expect(
      page.getByRole('menuitemradio', { name: '1.5×' }),
    ).toBeChecked();
  });

  test('shows the YouTube square at 100 by 100', async ({ page }) => {
    await openTrack(page, 'clx-playback-square');
    await readyToPlay(page);

    const { box } = await centerOf(page.getByTestId('dock-video'));

    expect(box.width).toBe(100);
    expect(box.height).toBe(100);
  });

  test('lays the dock out for a desktop: playback, progress and labeled tools beside the video', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openTrack(page, 'clx-playback-desktop');
    const play = await readyToPlay(page);

    const video = (await centerOf(page.getByTestId('dock-video'))).box;
    const button = (await centerOf(play)).box;
    const key = (
      await centerOf(
        page.getByRole('button', { name: dock.transpose, exact: true }),
      )
    ).box;
    const bar = (await centerOf(progress(page))).box;
    const settings = (
      await centerOf(page.getByRole('button', { name: dock.settings }))
    ).box;

    const mic = page.getByRole('button', { name: messages.en.practice.mic.on });
    const micBox = (await centerOf(mic)).box;
    await expect(page.getByTestId('dock-track-info')).toContainText(
      'Under Pressure',
    );
    await expect(page.getByTestId('dock-track-info')).toContainText('Queen');
    await expect(
      mic.getByText(messages.en.practice.mic.label, { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('button', { name: messages.en.streaks.inviteRing })
        .getByText(messages.en.streaks.practiceLabel, { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('button', { name: dock.settings })
        .getByText(dock.settings, { exact: true }),
    ).toBeVisible();
    expect(video.x + video.width).toBeLessThanOrEqual(bar.x);
    expect(key.x).toBeGreaterThanOrEqual(settings.x + settings.width);
    expect(bar.y).toBeGreaterThanOrEqual(button.y + button.height);
    expect(settings.y).toBeGreaterThanOrEqual(bar.y + bar.height);
    expect(Math.abs(settings.y - key.y)).toBeLessThan(2);
    expect(Math.abs(micBox.y - key.y)).toBeLessThan(2);
    expect(Math.abs(micBox.x - bar.x)).toBeLessThan(2);
    expect(
      Math.abs(button.x + button.width - (key.x + key.width)),
    ).toBeLessThan(2);
    expect(settings.x).toBeGreaterThan(bar.x);
    expect(settings.x + settings.width).toBeLessThanOrEqual(bar.x + bar.width);
  });

  test('fits labeled desktop tools at 768px in Portuguese', async ({
    page,
  }) => {
    const catalog = messages['pt-BR'];
    const controls = catalog.tracks.practice.dock;
    const id = 'clx-playback-desktop-pt-narrow';
    await page.setViewportSize({ width: 768, height: 900 });
    await setTrackMock({ tracks: [track(id)] });
    await page.goto(`/pt-BR/tracks/${id}`);
    await expect(
      page.getByRole('button', { name: controls.play }),
    ).toBeEnabled();
    const region = page.getByRole('region', { name: controls.label });
    await expect(
      region
        .getByRole('button', { name: controls.settings })
        .getByText(controls.settings, { exact: true }),
    ).toBeVisible();
    await expect(
      region
        .getByRole('button', { name: catalog.streaks.inviteRing })
        .getByText(catalog.streaks.practiceLabel, { exact: true }),
    ).toBeVisible();
    expect(
      await region.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return (
          element.scrollWidth <= element.clientWidth &&
          [...element.querySelectorAll('button')].every((button) => {
            const bounds = button.getBoundingClientRect();
            return bounds.x >= box.x && bounds.right <= box.right;
          })
        );
      }),
    ).toBe(true);
  });

  test('lays the dock out for a phone: playback above progress and a dedicated toolbar below', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openTrack(page, 'clx-playback-phone');
    const play = await readyToPlay(page);

    const button = (await centerOf(play)).box;
    const bar = (await centerOf(progress(page))).box;
    const video = (await centerOf(page.getByTestId('dock-video'))).box;
    const settings = (
      await centerOf(page.getByRole('button', { name: dock.settings }))
    ).box;
    const key = (
      await centerOf(
        page.getByRole('button', { name: dock.transpose, exact: true }),
      )
    ).box;

    await expect(page.getByTestId('dock-track-info')).toContainText(
      'Under Pressure',
    );
    await expect(page.getByTestId('dock-track-info')).toContainText('Queen');
    expect(button.x).toBeGreaterThanOrEqual(video.x + video.width);
    expect(bar.y).toBeGreaterThanOrEqual(button.y + button.height);
    expect(bar.y).toBeGreaterThanOrEqual(video.y + video.height);
    expect(settings.y).toBeGreaterThanOrEqual(bar.y + bar.height);
    expect(Math.abs(settings.y - key.y)).toBeLessThan(2);
    expect(key.x).toBeGreaterThanOrEqual(settings.x + settings.width);
    expect(bar.x).toBeLessThan(button.x);
    expect(video.x + video.width).toBeLessThanOrEqual(390);
  });

  test('shows only remaining time beside the bar and updates it when seeking', async ({
    page,
  }) => {
    await openTrack(page, 'clx-playback-remaining');
    await readyToPlay(page);
    const remaining = page.getByTestId('dock-remaining-time');
    await expect(remaining).toHaveText('-4:08');
    await expect(progress(page)).toHaveAttribute(
      'aria-valuetext',
      dock.progressValue
        .replace('{current}', '0:00')
        .replace('{total}', '4:08'),
    );
    await expect(remaining.locator('..').locator('span')).toHaveCount(1);
    await progress(page).press('End');
    await expect(remaining).toHaveText('-0:00');
    await progress(page).press('Home');
    await progress(page).press('ArrowRight');
    await expect(remaining).toHaveText('-4:03');
    await expect(progress(page)).toHaveAttribute('aria-valuenow', '5');
  });

  test('keeps the mobile toolbar in one row at 320px with long metadata', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    const id = 'clx-playback-narrow-toolbar';
    await setTrackMock({
      tracks: [
        {
          ...track(id),
          title: 'Under Pressure (Live at Wembley Stadium, London)',
          artistCredit: [
            {
              name: 'Queen featuring David Bowie and special guests',
              joinPhrase: '',
            },
          ],
        },
      ],
    });
    await page.goto(`/en/tracks/${id}`);
    await readyToPlay(page);
    const region = page.getByRole('region', { name: dock.label });
    const bounds = (await centerOf(region)).box;
    let previousRight = bounds.x;
    let rowY: number | undefined;
    for (const name of [
      messages.en.practice.mic.on,
      messages.en.streaks.inviteRing,
      dock.settings,
      dock.transpose,
    ]) {
      const box = (
        await centerOf(region.getByRole('button', { name, exact: true }))
      ).box;
      expect(box.width).toBeGreaterThanOrEqual(40);
      expect(box.height).toBeGreaterThanOrEqual(40);
      expect(box.x).toBeGreaterThanOrEqual(previousRight);
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(Math.abs(box.y - (rowY ?? box.y))).toBeLessThan(2);
      rowY = box.y;
      previousRight = box.x + box.width;
    }
    expect(
      await region.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  });

  test('toggles between remaining and elapsed time without seeking', async ({
    page,
  }) => {
    await openTrack(page, 'clx-playback-time-toggle');
    await readyToPlay(page);
    const time = page.getByTestId('dock-remaining-time');
    await progress(page).press('ArrowRight');
    await expect(time).toHaveText('-4:03');

    await page.getByRole('button', { name: dock.showElapsedTime }).click();
    await expect(time).toHaveText('0:05');
    await expect(progress(page)).toHaveAttribute('aria-valuenow', '5');
    await progress(page).press('ArrowRight');
    await expect(time).toHaveText('0:10');

    await page
      .getByRole('button', { name: dock.showRemainingTime })
      .press('Enter');
    await expect(time).toHaveText('-3:58');
    await expect(progress(page)).toHaveAttribute('aria-valuenow', '10');
  });

  test('leaves room for the dock under the page and keeps the timeline above it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openTrack(page, 'clx-playback-room');
    await readyToPlay(page);
    const timeline = page.getByRole('img', { name: /Under Pressure/ });

    const dockBox = (
      await centerOf(page.getByRole('region', { name: dock.label }))
    ).box;
    const rollBox = (await centerOf(timeline)).box;

    expect(rollBox.y + rollBox.height).toBeLessThanOrEqual(dockBox.y);
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.style.getPropertyValue('--dock-height'),
        ),
      )
      .toBe(`${dockBox.height}px`);
  });

  test('keeps the Track page and its dock without a video', async ({
    page,
  }) => {
    const id = 'clx-playback-no-video';
    await setTrackMock({ tracks: [{ ...track(id), youtubeVideoId: null }] });
    await page.goto(`/en/tracks/${id}`);

    await expect(
      page.getByRole('img', { name: /Under Pressure/ }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: dock.label })).toHaveCount(0);
  });
});

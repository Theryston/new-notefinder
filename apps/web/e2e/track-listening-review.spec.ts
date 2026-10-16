import { expect, type Page, test } from '@playwright/test';

import { setTrackMock } from './fake-track-api';
import { messages } from './messages';

const tools = messages.en.tracks.practice.listening;
const dock = messages.en.tracks.practice.dock;

async function prepare(page: Page, id: string) {
  await setTrackMock({
    tracks: [
      {
        id,
        title: 'Pressure',
        artistCredit: [{ name: 'Queen', joinPhrase: '' }],
        durationMs: 60000,
        youtubeVideoId: 'dQw4w9WgXcQ',
        processing: { status: 'COMPLETED' },
        notes: [{ pitch: 60, start: 20, end: 25 }],
        contributors: [],
        lyrics: [
          {
            start: 20,
            end: 22,
            words: [{ text: 'Sing this line', start: 20, end: 22 }],
          },
        ],
      },
    ],
  });
  await page.goto(`/en/tracks/${id}`);
  await expect(page.getByRole('button', { name: dock.play })).toBeEnabled();
}

async function loopOn(page: Page) {
  await page.getByRole('button', { name: dock.settings }).click();
  await page
    .getByRole('menuitemcheckbox', { name: tools.loop, exact: true })
    .click();
}

test('phone loop handle keeps a narrow visual and a forty-pixel draggable hit area', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, 'clx-review-hit-target');
  await loopOn(page);
  const handle = page.getByRole('slider', { name: tools.loopEnd });
  const box = await handle.boundingBox();
  if (!box) throw new Error('loop handle is missing');
  const center = box.x + 20 + (box.width - 40) / 6;
  // Grab outside the sixteen-pixel visual, inside the forty-pixel hit area.
  await page.mouse.move(center + 15, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(center + 45, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  expect(Number(await handle.inputValue())).toBeGreaterThan(12);
});

test('landscape phone lyric taps select the loop without narrowing the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await prepare(page, 'clx-review-landscape-loop');
  await loopOn(page);
  await page
    .getByRole('button', { name: 'Sing this line', exact: true })
    .click();
  await expect(page.getByRole('slider', { name: tools.loopStart })).toHaveValue(
    '20',
  );
  await expect(page.getByRole('slider', { name: tools.loopEnd })).toHaveValue(
    '22',
  );
});

test('landscape phone fullscreen keeps the current lyric, actions, timeline and dock', async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await prepare(page, 'clx-review-landscape-fullscreen');
  await page.getByRole('button', { name: tools.fullscreen }).click();
  await expect(page.locator('.practice-fullscreen')).toHaveJSProperty(
    'offsetWidth',
    844,
  );
  const actions = page.locator('.practice-listening-actions');
  await expect(actions).toBeVisible();
  await expect(page.getByTestId('karaoke-line')).toBeVisible();
  await expect(page.locator('.practice-lyrics')).toBeHidden();
  const canvas = page.getByRole('img', { name: /Note timeline/ });
  await expect(canvas).toBeVisible();
  const controls = page.getByRole('region', { name: dock.label });
  await expect(controls).toBeVisible();
  const karaoke = await page.getByTestId('karaoke-line').boundingBox();
  const roll = await canvas.boundingBox();
  const bar = await controls.boundingBox();
  if (!roll || !karaoke || !bar)
    throw new Error('fullscreen timeline, lyric or dock is missing');
  expect(roll.y + roll.height).toBeLessThanOrEqual(karaoke.y);
  expect(karaoke.y + karaoke.height).toBeLessThanOrEqual(bar.y);
  await actions.getByRole('button', { name: tools.fullscreen }).click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);
});

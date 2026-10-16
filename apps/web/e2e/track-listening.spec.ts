import { expect, type Page, test } from '@playwright/test';

import { setTrackMock } from './fake-track-api';
import { messages } from './messages';

const tools = messages.en.tracks.practice.listening;
const dock = messages.en.tracks.practice.dock;

async function open(page: Page, id: string) {
  await setTrackMock({
    tracks: [
      {
        id,
        title: 'Under Pressure',
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
            words: [{ text: 'Pressure', start: 20, end: 22 }],
          },
        ],
      },
    ],
  });
  await page.goto(`/en/tracks/${id}`);
  await expect(page.getByRole('button', { name: dock.play })).toBeEnabled();
}

async function enableLoop(page: Page) {
  await page.getByRole('button', { name: dock.settings }).click();
  await page
    .getByRole('menuitemcheckbox', { name: tools.loop, exact: true })
    .click();
}

const position = (page: Page) =>
  page.getByRole('slider', { name: dock.progress });

test('skips a long intro to one second before the next notes', async ({
  page,
}) => {
  await open(page, 'clx-listening-next');
  await page.getByRole('button', { name: tools.nextNotes }).click();
  await expect(position(page)).toHaveAttribute('aria-valuenow', '19');
  await expect(
    page.getByRole('button', { name: tools.nextNotes }),
  ).toBeHidden();
});

test('drags the loop end handle and repeats the selected section', async ({
  page,
}) => {
  await open(page, 'clx-listening-handles');
  await enableLoop(page);
  const end = page.getByRole('slider', { name: tools.loopEnd });
  const box = await end.boundingBox();
  if (!box) throw new Error('loop handle not visible');
  await page.mouse.move(box.x + box.width * (10 / 60), box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * (2 / 60), box.y + box.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  expect(Number(await end.inputValue())).toBeLessThan(4);
  await page.getByRole('button', { name: dock.play }).click();
  await expect
    .poll(async () =>
      Number(await position(page).getAttribute('aria-valuenow')),
    )
    .toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(4000);
  expect(
    Number(await position(page).getAttribute('aria-valuenow')),
  ).toBeLessThan(4);
});

test('phone lyric tap sets the line as the loop and disabling restores playback', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'clx-listening-lyrics');
  await enableLoop(page);
  await page.getByRole('button', { name: 'Pressure', exact: true }).click();
  await expect(page.getByRole('slider', { name: tools.loopStart })).toHaveValue(
    '20',
  );
  await expect(page.getByRole('slider', { name: tools.loopEnd })).toHaveValue(
    '22',
  );
  await page.getByRole('button', { name: dock.play }).click();
  await page.waitForTimeout(2500);
  expect(
    Number(await position(page).getAttribute('aria-valuenow')),
  ).toBeLessThan(22);
  await enableLoop(page);
  await expect(page.getByRole('slider', { name: tools.loopStart })).toHaveCount(
    0,
  );
  await expect
    .poll(async () =>
      Number(await position(page).getAttribute('aria-valuenow')),
    )
    .toBeGreaterThanOrEqual(23);
});

test('fullscreen is requested only by its optional button', async ({
  page,
}) => {
  await open(page, 'clx-listening-fullscreen');
  expect(await page.evaluate(() => document.fullscreenElement === null)).toBe(
    true,
  );
  await page.getByRole('button', { name: tools.fullscreen }).click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement !== null))
    .toBe(true);
  await page.getByRole('button', { name: dock.settings }).click();
  await expect(
    page.getByRole('menuitemcheckbox', { name: tools.loop, exact: true }),
  ).toBeVisible();
  await page
    .getByRole('menuitemcheckbox', { name: tools.loop, exact: true })
    .click();
  await page.getByRole('button', { name: tools.fullscreen }).click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);
});

test('fullscreen keeps the floating dock clear of the current lyric line', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, 'clx-fullscreen-dock-lyrics');
  const karaoke = page.getByTestId('karaoke-line');
  await expect(karaoke).toHaveText('Pressure');
  await page.getByRole('button', { name: tools.fullscreen }).click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement !== null))
    .toBe(true);
  const dockBox = await page
    .getByRole('region', { name: dock.label })
    .boundingBox();
  const line = await karaoke.boundingBox();
  if (!dockBox || !line) throw new Error('dock or lyric line is missing');
  expect(line.y + line.height).toBeLessThanOrEqual(dockBox.y);
});

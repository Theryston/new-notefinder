import { expect, test } from '@playwright/test';

import { setTrackMock } from './fake-track-api';
import { messages } from './messages';

const dock = messages.en.tracks.practice.dock;
const tools = messages.en.tracks.practice.listening;

test('phone loop handle aligns with its time and grabbing its edge does not seek', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const id = 'clx-loop-grab-aligned';
  await setTrackMock({
    tracks: [
      {
        id,
        title: 'Under Pressure',
        artistCredit: [{ name: 'Queen', joinPhrase: '' }],
        durationMs: 360000,
        youtubeVideoId: 'dQw4w9WgXcQ',
        processing: { status: 'COMPLETED' },
        notes: [{ pitch: 60, start: 30, end: 40 }],
        contributors: [],
      },
    ],
  });
  await page.goto(`/en/tracks/${id}`);
  await expect(
    page.getByRole('button', { name: dock.play, exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: dock.settings }).click();
  await page
    .getByRole('menuitemcheckbox', { name: tools.loop, exact: true })
    .click();
  const end = page.getByRole('slider', { name: tools.loopEnd });
  const box = await end.boundingBox();
  if (!box) throw new Error('loop handle is missing');
  const track = await page
    .getByRole('slider', { name: dock.progress })
    .boundingBox();
  if (!track) throw new Error('progress track is missing');
  const center = track.x + track.width * (10 / 360);
  const y = box.y + box.height / 2;
  const bounds = await end.evaluate(
    (element, position) => {
      const hits: number[] = [];
      for (
        let x = Math.floor(position.center - 25);
        x <= position.center + 25;
        x++
      ) {
        if (document.elementFromPoint(x, position.y) === element) hits.push(x);
      }
      return { first: hits.at(0), last: hits.at(-1), count: hits.length };
    },
    { center, y },
  );
  expect(bounds.count).toBeGreaterThanOrEqual(39);
  expect(bounds.first).toBeDefined();
  expect(bounds.last).toBeDefined();
  expect(
    Math.abs(((bounds.first ?? 0) + (bounds.last ?? 0)) / 2 - center),
  ).toBeLessThan(1);
  await page.mouse.move(center, y);
  await page.mouse.down();
  await page.mouse.up();
  await expect(end).toHaveValue('10');
  await page.mouse.move(center + 15, y);
  await page.mouse.down();
  await page.mouse.up();
  await expect(end).toHaveValue('10');
  await end.press('ArrowRight');
  await expect(end).toHaveValue('10.1');
});

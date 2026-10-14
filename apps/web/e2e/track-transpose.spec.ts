import { expect, test } from '@playwright/test';

import { type FakeTrack, setTrackMock } from './fake-track-api';
import { messages } from './messages';

const trackId = 'clx-track-transpose';
const track: FakeTrack = {
  id: trackId,
  title: 'Under Pressure',
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  durationMs: 248_000,
  youtubeVideoId: 'a01QQZyl-_I',
  vocalRange: { lowMidi: 62, highMidi: 74 },
  estimatedKey: { tonic: 7, mode: 'MAJOR' },
  processing: { status: 'COMPLETED' },
  notes: [{ pitch: 62, start: 2, end: 3 }],
  contributors: [],
};

test('transposing moves the displayed notes and metadata, explains YouTube playback, and persists per Track', async ({
  page,
}) => {
  await setTrackMock({ tracks: [track] });
  await page.goto('/en/tracks/clx-track-transpose');

  await expect(page.getByText('Estimated key: G major')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Vocal range from D4 to D5' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: /1 note, from D4 to D4/ }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: messages.en.tracks.practice.dock.transpose.up,
    })
    .click();

  await expect(
    page.getByText(messages.en.tracks.practice.dock.transpose.videoUnchanged),
  ).toBeVisible();
  await expect(page.getByText('Estimated key: G# major')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Vocal range from D#4 to D#5' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: /1 note, from D#4 to D#4/ }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByText('Estimated key: G# major')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Vocal range from D#4 to D#5' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: /1 note, from D#4 to D#4/ }),
  ).toBeVisible();
});

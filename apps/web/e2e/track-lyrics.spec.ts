import { expect, test } from '@playwright/test';

import { type FakeTrack, setTrackMock } from './fake-track-api';
import { messages } from './messages';

const lyrics = [
  {
    start: 0,
    end: 2,
    words: [
      { text: 'Hello', start: 0.2, end: 0.7 },
      { text: 'world', start: 1, end: 1.5 },
    ],
  },
  {
    start: 3,
    end: 5,
    words: [
      { text: 'Sing', start: 3.1, end: 3.6 },
      { text: 'along', start: 4, end: 4.5 },
    ],
  },
];

const completedTrack = (id: string): FakeTrack => ({
  id,
  title: 'Under Pressure',
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  durationMs: 248_000,
  youtubeVideoId: 'dQw4w9WgXcQ',
  processing: { status: 'COMPLETED' },
  notes: [
    { pitch: 49, start: 0, end: 1.5 },
    { pitch: 64, start: 2, end: 3 },
  ],
  lyrics,
  contributors: [],
});

test.describe('Track Timed lyrics and shared playback links', () => {
  test('clicking a lyric line seeks and current words are highlighted', async ({
    page,
  }) => {
    const trackId = 'clx-lyrics-click';
    await setTrackMock({ tracks: [completedTrack(trackId)] });
    await page.goto(`/en/tracks/${trackId}`);

    const line = page.getByRole('button', { name: 'Sing along' });
    await expect(line).toBeVisible();
    await line.click();
    await expect(
      page.getByRole('slider', {
        name: messages.en.tracks.practice.dock.progress,
      }),
    ).toHaveAttribute('aria-valuenow', '3');
    await expect(line).toHaveAttribute('aria-current', 'true');

    await page.goto(`/en/tracks/${trackId}?time=4.2`);
    await expect(
      page.locator('[data-current-word="true"]').filter({ hasText: 'along' }),
    ).toHaveCount(2);
  });

  test('keeps time and timeline focus through a legacy-ID redirect', async ({
    page,
  }) => {
    const trackId = 'clx-lyrics-legacy-target';
    await setTrackMock({
      tracks: [completedTrack(trackId)],
      legacyMap: { 'legacy-lyrics-link': trackId },
    });
    await page.setViewportSize({ width: 390, height: 500 });

    await page.goto(
      `/en/tracks/legacy-lyrics-link?time=12.5&timeline-focus=true`,
    );

    await expect(page).toHaveURL(
      new RegExp(`/en/tracks/${trackId}\\?time=12.5&timeline-focus=true$`),
    );
    await expect(
      page.getByRole('slider', {
        name: messages.en.tracks.practice.dock.progress,
      }),
    ).toHaveAttribute('aria-valuenow', '13');
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    await expect(page.getByTestId('track-timeline')).toBeInViewport();
  });
});

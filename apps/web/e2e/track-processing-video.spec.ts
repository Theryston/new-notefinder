import { expect, test } from '@playwright/test';

import { type FakeTrack, setTrackMock } from './fake-track-api';
import { messages as catalogs } from './messages';

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;

/** A Track of the fake API, with the Processing state a test needs. */
const trackWith = (
  id: string,
  processing: FakeTrack['processing'],
): FakeTrack => ({
  id,
  title: 'Bohemian Rhapsody',
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  processing,
  contributors: [],
});

const CHOSEN_VIDEO = 'dQw4w9WgXcQ';

for (const { locale, messages } of cases) {
  const video = messages.tracks.processing.video;

  test.describe(`chosen video (${locale})`, () => {
    test('links the video the Processing chose, with where it came from', async ({
      page,
    }) => {
      const trackId = `clx-video-${locale}`;
      await setTrackMock({
        tracks: [
          trackWith(trackId, {
            status: 'DETECTING_NOTES',
            video: { id: CHOSEN_VIDEO, source: 'musicbrainz' },
          }),
        ],
      });

      await page.goto(`/${locale}/tracks/${trackId}`);

      await expect(
        page.getByRole('heading', { level: 2, name: video.title }),
      ).toBeVisible();
      await expect(page.getByText(video.source.musicbrainz)).toBeVisible();
      await expect(
        page.getByRole('link', { name: video.watch }),
      ).toHaveAttribute(
        'href',
        `https://www.youtube.com/watch?v=${CHOSEN_VIDEO}`,
      );
    });

    test('shows the video as soon as the Processing has found it, while it runs', async ({
      page,
    }) => {
      const trackId = `clx-video-running-${locale}`;
      await setTrackMock({
        tracks: [
          trackWith(trackId, {
            status: 'DOWNLOADING_AUDIO',
            video: { id: CHOSEN_VIDEO, source: 'youtube_music' },
          }),
        ],
      });

      await page.goto(`/${locale}/tracks/${trackId}`);

      await expect(page.getByText(video.source.youtube_music)).toBeVisible();
    });

    test('shows no video before the Processing has chosen one', async ({
      page,
    }) => {
      const trackId = `clx-video-none-${locale}`;
      await setTrackMock({
        tracks: [trackWith(trackId, { status: 'FINDING_VIDEO', video: null })],
      });

      await page.goto(`/${locale}/tracks/${trackId}`);

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(
        page.getByRole('heading', { level: 2, name: video.title }),
      ).toHaveCount(0);
    });

    test('shows the translated reason, and no video, when no video matches', async ({
      page,
    }) => {
      const trackId = `clx-video-missing-${locale}`;
      await setTrackMock({
        tracks: [
          trackWith(trackId, {
            status: 'FAILED',
            failureCode: 'VIDEO_NOT_FOUND',
            resumeFrom: 'FINDING_VIDEO',
            retryable: false,
            video: null,
          }),
        ],
      });

      await page.goto(`/${locale}/tracks/${trackId}`);

      await expect(
        page.getByText(
          messages.tracks.processing.failed.reason.VIDEO_NOT_FOUND,
        ),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { level: 2, name: video.title }),
      ).toHaveCount(0);
    });

    test('shows the translated reason of a Recording too long to process', async ({
      page,
    }) => {
      const trackId = `clx-video-long-${locale}`;
      await setTrackMock({
        tracks: [
          trackWith(trackId, {
            status: 'FAILED',
            failureCode: 'TOO_LONG',
            resumeFrom: 'FINDING_VIDEO',
            retryable: false,
            video: null,
          }),
        ],
      });

      await page.goto(`/${locale}/tracks/${trackId}`);

      await expect(
        page.getByText(messages.tracks.processing.failed.reason.TOO_LONG),
      ).toBeVisible();
    });
  });
}

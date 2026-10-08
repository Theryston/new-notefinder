import { trackProcessingSchema } from '@notefinder/contracts';
import {
  isRetryableFailureCode,
  type TrackProcessingRow,
  toTrackProcessing,
} from './track-processing-view.js';

const row = (
  overrides: Partial<TrackProcessingRow> = {},
): TrackProcessingRow => ({
  id: 'processing-1',
  status: 'QUEUED',
  failureCode: null,
  resumeFrom: null,
  videoId: null,
  videoSource: null,
  createdAt: new Date('2026-10-08T12:00:00.000Z'),
  startedAt: null,
  finishedAt: null,
  ...overrides,
});

describe('isRetryableFailureCode', () => {
  it.each([
    ['VIDEO_NOT_FOUND', false],
    ['TOO_LONG', false],
    ['DOWNLOAD_FAILED', true],
    ['NOTE_DETECTION_FAILED', true],
    ['INTERNAL', true],
  ] as const)('%s is retryable: %s', (code, retryable) => {
    expect(isRetryableFailureCode(code)).toBe(retryable);
  });
});

describe('toTrackProcessing', () => {
  it('shows a queued Processing with no video and no timestamps but creation', () => {
    const view = toTrackProcessing(row());

    expect(view).toEqual({
      id: 'processing-1',
      status: 'QUEUED',
      failureCode: null,
      retryable: false,
      resumeFrom: null,
      video: null,
      createdAt: '2026-10-08T12:00:00.000Z',
      startedAt: null,
      finishedAt: null,
    });
    expect(trackProcessingSchema.parse(view)).toEqual(view);
  });

  it('marks a failure that can be retried as retryable, with the step to resume from', () => {
    const view = toTrackProcessing(
      row({
        status: 'FAILED',
        failureCode: 'DOWNLOAD_FAILED',
        resumeFrom: 'DOWNLOADING_AUDIO',
        startedAt: new Date('2026-10-08T12:01:00.000Z'),
        finishedAt: new Date('2026-10-08T12:02:00.000Z'),
      }),
    );

    expect(view).toMatchObject({
      status: 'FAILED',
      failureCode: 'DOWNLOAD_FAILED',
      retryable: true,
      resumeFrom: 'DOWNLOADING_AUDIO',
      startedAt: '2026-10-08T12:01:00.000Z',
      finishedAt: '2026-10-08T12:02:00.000Z',
    });
  });

  it('marks a final failure as not retryable', () => {
    const view = toTrackProcessing(
      row({ status: 'FAILED', failureCode: 'VIDEO_NOT_FOUND' }),
    );

    expect(view).toMatchObject({ retryable: false });
  });

  it('is never retryable outside a failure, whatever failure code is stored', () => {
    const view = toTrackProcessing(
      row({ status: 'DOWNLOADING_AUDIO', failureCode: 'INTERNAL' }),
    );

    expect(view).toMatchObject({ retryable: false });
  });

  it('shows the chosen video with its source once one is chosen', () => {
    const view = toTrackProcessing(
      row({
        status: 'EXTRACTING_VOCALS',
        videoId: 'dQw4w9WgXcQ',
        videoSource: 'youtube_music',
      }),
    );

    expect(view.video).toEqual({ id: 'dQw4w9WgXcQ', source: 'youtube_music' });
  });
});

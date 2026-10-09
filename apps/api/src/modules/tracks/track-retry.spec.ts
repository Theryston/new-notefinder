import { type RetryableProcessing, retryPlanOf } from './track-retry.js';

const failed = (
  overrides: Partial<RetryableProcessing> = {},
): RetryableProcessing => ({
  status: 'FAILED',
  failureCode: 'INTERNAL',
  resumeFrom: 'FINDING_VIDEO',
  videoId: 'aaaaaaaaaaa',
  videoSource: 'musicbrainz',
  musicWavUrl: null,
  musicMp3Url: null,
  vocalsWavUrl: null,
  vocalsMp3Url: null,
  runpodJobId: null,
  ...overrides,
});

describe('retryPlanOf', () => {
  it('starts a retry at the step that failed, with the outputs that run kept', () => {
    expect(retryPlanOf(failed())).toEqual({
      resumeFrom: 'FINDING_VIDEO',
      outputs: {
        videoId: 'aaaaaaaaaaa',
        videoSource: 'musicbrainz',
        musicWavUrl: null,
        musicMp3Url: null,
        vocalsWavUrl: null,
        vocalsMp3Url: null,
      },
    });
  });

  it.each([
    ['no Processing at all', undefined],
    [
      'a Processing that is queued',
      failed({ status: 'QUEUED', failureCode: null, resumeFrom: null }),
    ],
    [
      'a Processing that completed',
      failed({ status: 'COMPLETED', failureCode: null, resumeFrom: null }),
    ],
    [
      'a Processing that is running',
      failed({ status: 'FINDING_VIDEO', failureCode: null }),
    ],
    ['a failure with no code', failed({ failureCode: null })],
    [
      'VIDEO_NOT_FOUND, which repeating cannot fix',
      failed({ failureCode: 'VIDEO_NOT_FOUND' }),
    ],
    [
      'TOO_LONG, which repeating cannot fix',
      failed({ failureCode: 'TOO_LONG' }),
    ],
    ['a failure without the step it stopped at', failed({ resumeFrom: null })],
  ])('refuses %s', (_, latest) => {
    expect(retryPlanOf(latest)).toBeUndefined();
  });

  it.each(['DOWNLOAD_FAILED', 'NOTE_DETECTION_FAILED', 'INTERNAL'] as const)(
    'allows a retry after %s',
    (failureCode) => {
      expect(retryPlanOf(failed({ failureCode }))).toBeDefined();
    },
  );
});

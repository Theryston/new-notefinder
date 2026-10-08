import type { TrackProcessingState } from '@notefinder/contracts';
import { describe, expect, it } from 'vitest';

import {
  PROCESSING_POLL_INTERVAL_MS,
  processingRefetchInterval,
} from './processing-polling';

const stateWith = (
  status: 'QUEUED' | 'DETECTING_NOTES' | 'COMPLETED' | 'FAILED' | null,
): TrackProcessingState => ({
  track: {
    id: 'track-1',
    title: 'Bohemian Rhapsody',
    coverUrl: null,
    artistCredit: [],
  },
  processing:
    status === null
      ? null
      : {
          id: 'processing-1',
          status,
          failureCode: status === 'FAILED' ? 'DOWNLOAD_FAILED' : null,
          retryable: status === 'FAILED',
          resumeFrom: status === 'FAILED' ? 'DOWNLOADING_AUDIO' : null,
          video: null,
          createdAt: '2026-10-08T12:00:00.000Z',
          startedAt: null,
          finishedAt: null,
        },
  contributors: [],
});

describe('processingRefetchInterval', () => {
  it('polls about every 1.5 seconds while the Processing runs', () => {
    expect(PROCESSING_POLL_INTERVAL_MS).toBe(1500);
    expect(processingRefetchInterval(stateWith('QUEUED'))).toBe(1500);
    expect(processingRefetchInterval(stateWith('DETECTING_NOTES'))).toBe(1500);
  });

  it.each(['COMPLETED', 'FAILED'] as const)(
    'stops polling once the Processing is %s',
    (status) => {
      expect(processingRefetchInterval(stateWith(status))).toBe(false);
    },
  );

  it('does not poll a Track that has no Processing', () => {
    expect(processingRefetchInterval(stateWith(null))).toBe(false);
  });

  it('does not poll before any state is known', () => {
    expect(processingRefetchInterval(undefined)).toBe(false);
  });
});

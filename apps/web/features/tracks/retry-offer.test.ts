import type { TrackProcessing } from '@notefinder/contracts';
import { describe, expect, it } from 'vitest';

import { isRetryOffered, retrySignInPath } from './retry-offer';

const processing = (overrides: Partial<TrackProcessing>): TrackProcessing => ({
  id: 'processing-1',
  status: 'FAILED',
  failureCode: 'INTERNAL',
  retryable: true,
  resumeFrom: 'FINDING_VIDEO',
  video: null,
  createdAt: '2026-10-08T12:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  ...overrides,
});

describe('isRetryOffered', () => {
  it('offers a retry after a failure the API says can be retried', () => {
    expect(isRetryOffered(processing({}))).toBe(true);
  });

  it.each([
    ['a failure that repeating cannot fix', processing({ retryable: false })],
    [
      'a Processing that is still running',
      processing({
        status: 'FINDING_VIDEO',
        failureCode: null,
        retryable: false,
      }),
    ],
    [
      'a Processing that completed',
      processing({ status: 'COMPLETED', failureCode: null, retryable: false }),
    ],
    ['a Track with no Processing', null],
  ])('does not offer one for %s', (_, value) => {
    expect(isRetryOffered(value)).toBe(false);
  });
});

describe('retrySignInPath', () => {
  it('brings the visitor back to the Track page they retry from', () => {
    expect(retrySignInPath('clx123abc')).toBe('/tracks/clx123abc');
  });

  it('encodes the Track ID in the path', () => {
    expect(retrySignInPath('a/b')).toBe('/tracks/a%2Fb');
  });
});

import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

import { albumFound, albumResultFromError } from './album-result';

const album = {
  id: 'album-1',
  mbid: '00000000-0000-4000-8000-00000000a001',
  title: 'A Night at the Opera',
  primaryType: 'Album',
  secondaryTypes: [],
  year: 1975,
  genres: ['rock'],
  coverArtUrl: null,
  artists: [{ id: 'artist-1', name: 'Queen' }],
};

describe('albumFound', () => {
  it('wraps the header detail', () => {
    expect(albumFound(album)).toEqual({ status: 'found', album });
  });
});

describe('albumResultFromError', () => {
  it('maps RESOURCE_MOVED with the new ID to a redirect', () => {
    expect(
      albumResultFromError(
        new ApiError({
          statusCode: 404,
          code: 'RESOURCE_MOVED',
          message: 'Album moved',
          details: { id: 'album-1' },
        }),
      ),
    ).toEqual({ status: 'moved', newId: 'album-1' });
  });

  it('maps a NOT_FOUND envelope to a real 404', () => {
    expect(
      albumResultFromError(
        new ApiError({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Album not found',
        }),
      ),
    ).toEqual({ status: 'missing' });
  });

  it('lets a server error through so it surfaces as an error', () => {
    expect(
      albumResultFromError(
        new ApiError({
          statusCode: 500,
          code: 'INTERNAL_ERROR',
          message: 'boom',
        }),
      ),
    ).toBeUndefined();
  });

  it('lets anything that is not an API error through', () => {
    expect(albumResultFromError(new Error('network down'))).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

import { artistFound, artistResultFromError } from './artist-result';

const artist = {
  id: 'artist-1',
  mbid: '00000000-0000-4000-8000-000000001001',
  name: 'Queen',
  genres: ['rock'],
  trackCount: 2,
};

describe('artistFound', () => {
  it('wraps the header detail', () => {
    expect(artistFound(artist)).toEqual({ status: 'found', artist });
  });
});

describe('artistResultFromError', () => {
  it('maps RESOURCE_MOVED with the new ID to a redirect', () => {
    expect(
      artistResultFromError(
        new ApiError({
          statusCode: 404,
          code: 'RESOURCE_MOVED',
          message: 'Artist moved',
          details: { id: 'artist-1' },
        }),
      ),
    ).toEqual({ status: 'moved', newId: 'artist-1' });
  });

  it('maps a serialized RESOURCE_MOVED that lost its prototype', () => {
    const serialized = JSON.parse(
      JSON.stringify(
        new ApiError({
          statusCode: 404,
          code: 'RESOURCE_MOVED',
          message: 'Artist moved',
          details: { id: 'artist-1' },
        }),
      ),
    ) as unknown;

    expect(serialized instanceof ApiError).toBe(false);
    expect(artistResultFromError(serialized)).toEqual({
      status: 'moved',
      newId: 'artist-1',
    });
  });

  it.each(['NOT_FOUND', 'FORBIDDEN'] as const)(
    'maps %s with a 404 status to a real 404',
    (code) => {
      expect(
        artistResultFromError(
          new ApiError({ statusCode: 404, code, message: code }),
        ),
      ).toEqual({ status: 'missing' });
    },
  );

  it('returns undefined for RESOURCE_MOVED with malformed details', () => {
    expect(
      artistResultFromError(
        new ApiError({
          statusCode: 404,
          code: 'RESOURCE_MOVED',
          message: 'Artist moved',
          details: { id: '' },
        }),
      ),
    ).toBeUndefined();
  });

  it.each([
    new ApiError({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Broken',
    }),
    new Error('boom'),
    null,
  ])('returns undefined for a genuine failure %j', (error) => {
    expect(artistResultFromError(error)).toBeUndefined();
  });
});

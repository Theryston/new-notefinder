import { describe, expect, it } from 'vitest';

import { ApiError, internalApiError, isApiError } from './api-error';

describe('isApiError', () => {
  it('matches a real ApiError', () => {
    const error = new ApiError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Artist not found',
    });

    expect(isApiError(error)).toBe(true);
  });

  it('matches a copy that lost its prototype crossing the cache boundary', () => {
    // `'use cache'` fetchers serialize thrown errors: `instanceof` misses
    // them while their fields survive.
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
    expect(isApiError(serialized)).toBe(true);
  });

  it('rejects anything without the envelope shape', () => {
    expect(isApiError(new Error('boom'))).toBe(false);
    expect(isApiError({ code: 'NOT_FOUND' })).toBe(false);
    expect(isApiError({ statusCode: 404 })).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError('NOT_FOUND')).toBe(false);
  });

  it('builds an internal error for network and contract failures', () => {
    const error = internalApiError('Network error calling /v1/artists/x');

    expect(error).toBeInstanceOf(ApiError);
    expect(isApiError(error)).toBe(true);
    expect(error.code).toBe('INTERNAL_ERROR');
  });
});

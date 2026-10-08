import type { ApiError } from '@notefinder/contracts';
import { describe, expect, it } from 'vitest';

import { ApiError as ApiErrorClass } from '@/lib/api/api-error';

import { requestErrorMessage } from './request-error';

const apiError = (body: ApiError) => new ApiErrorClass(body);

describe('requestErrorMessage', () => {
  it('names the active limit, with its maximum, when the API says it was reached', () => {
    expect(
      requestErrorMessage(
        apiError({
          statusCode: 429,
          code: 'PROCESSING_LIMIT_REACHED',
          message: 'Track request limit reached',
          details: { limit: 'ACTIVE_PROCESSINGS', max: 3 },
        }),
      ),
    ).toEqual({
      key: 'errors.processingLimit.ACTIVE_PROCESSINGS',
      values: { max: 3 },
    });
  });

  it('names the daily limit, with its maximum, when that one was reached', () => {
    expect(
      requestErrorMessage(
        apiError({
          statusCode: 429,
          code: 'PROCESSING_LIMIT_REACHED',
          message: 'Track request limit reached',
          details: { limit: 'NEW_TRACKS_PER_DAY', max: 20 },
        }),
      ),
    ).toEqual({
      key: 'errors.processingLimit.NEW_TRACKS_PER_DAY',
      values: { max: 20 },
    });
  });

  it('falls back to the generic limit message when the details are missing or unknown', () => {
    expect(
      requestErrorMessage(
        apiError({
          statusCode: 429,
          code: 'PROCESSING_LIMIT_REACHED',
          message: 'Track request limit reached',
        }),
      ),
    ).toEqual({ key: 'errors.PROCESSING_LIMIT_REACHED' });
  });

  it('uses the message of any other API error code', () => {
    expect(
      requestErrorMessage(
        apiError({
          statusCode: 503,
          code: 'SERVICE_UNAVAILABLE',
          message: 'Catalog down',
        }),
      ),
    ).toEqual({ key: 'errors.SERVICE_UNAVAILABLE' });
  });

  it('treats anything that is not an API error as an internal error', () => {
    expect(requestErrorMessage(new Error('network down'))).toEqual({
      key: 'errors.INTERNAL_ERROR',
    });
  });
});

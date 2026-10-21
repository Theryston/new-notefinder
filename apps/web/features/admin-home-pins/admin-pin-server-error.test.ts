import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

import {
  pinFormFieldLabelKey,
  serverValidationBackendReason,
  serverValidationFieldErrors,
} from './admin-pin-server-error';

function validationError(details: unknown, message = 'The pin is invalid') {
  return new ApiError({
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message,
    details,
  });
}

describe('serverValidationFieldErrors', () => {
  it('maps a title issue to its form field', () => {
    const error = validationError({
      location: 'body',
      issues: [{ code: 'too_small', path: ['titles', 'en'] }],
    });

    expect(serverValidationFieldErrors(error)).toEqual([
      { field: 'titleEn', type: 'too_small' },
    ]);
  });

  it('skips eligibility refusals, which need the backend reason instead', () => {
    const error = validationError({
      location: 'custom',
      issues: [
        {
          code: 'custom',
          path: ['source', 'trackIds'],
          message: 'The Track has not completed its Processing',
          trackId: 'trk_a',
        },
      ],
    });

    expect(serverValidationFieldErrors(error)).toEqual([]);
  });

  it('returns nothing without validation issues', () => {
    expect(
      serverValidationFieldErrors(
        new ApiError({ statusCode: 403, code: 'FORBIDDEN', message: 'No' }),
      ),
    ).toEqual([]);
    expect(serverValidationFieldErrors(new Error('boom'))).toEqual([]);
  });
});

describe('serverValidationBackendReason', () => {
  it('names ineligible tracks with the backend message', () => {
    const error = validationError({
      location: 'custom',
      issues: [
        {
          code: 'custom',
          path: ['source', 'trackIds'],
          message: 'The Track has not completed its Processing',
          trackId: 'trk_a',
        },
        {
          code: 'custom',
          path: ['source', 'trackIds'],
          message: 'The Track has not completed its Processing',
          trackId: 'trk_b',
        },
      ],
    });

    expect(serverValidationBackendReason(error)).toBe(
      'The Track has not completed its Processing: trk_a, trk_b',
    );
  });

  it('carries a refused dynamic source message', () => {
    const error = validationError({
      location: 'custom',
      issues: [
        {
          code: 'custom',
          path: ['source'],
          message: 'The genre has fewer than 6 eligible Tracks',
        },
      ],
    });

    expect(serverValidationBackendReason(error)).toBe(
      'The genre has fewer than 6 eligible Tracks',
    );
  });

  it('returns null without a usable backend message', () => {
    expect(
      serverValidationBackendReason(
        new ApiError({ statusCode: 403, code: 'FORBIDDEN', message: 'No' }),
      ),
    ).toBeNull();
  });
});

describe('pinFormFieldLabelKey', () => {
  it('names the tracks field label', () => {
    expect(pinFormFieldLabelKey('trackIdsText')).toBe('trackIds.label');
    expect(pinFormFieldLabelKey('titleEn')).toBe('titleEn.label');
  });
});

import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

import {
  pinFormFieldLabelKey,
  serverEligibilityErrors,
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

  it('skips eligibility refusals, which the toast translates by reason', () => {
    const error = validationError({
      location: 'custom',
      issues: [
        {
          code: 'custom',
          path: ['source', 'trackIds'],
          message: 'The Track has not completed its Processing',
          reason: 'TRACK_NOT_COMPLETED',
          trackId: 'trk_a',
        },
      ],
    });

    expect(serverValidationFieldErrors(error)).toEqual([]);
  });

  it('ignores unknown reasons, which fall back to the generic message', () => {
    const error = validationError({
      location: 'custom',
      issues: [
        {
          code: 'custom',
          path: ['source', 'trackIds'],
          message: 'Something else',
          reason: 'SOMETHING_ELSE',
          trackId: 'trk_a',
        },
      ],
    });

    expect(serverValidationFieldErrors(error)).toEqual([
      { field: 'trackIdsText', type: 'custom' },
    ]);
    expect(serverEligibilityErrors(error)).toEqual([]);
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

describe('serverEligibilityErrors', () => {
  it('groups refusing tracks by reason with their ids', () => {
    const error = validationError({
      location: 'custom',
      issues: [
        {
          code: 'custom',
          path: ['source', 'trackIds'],
          message: 'The Track has not completed its Processing',
          reason: 'TRACK_NOT_COMPLETED',
          trackId: 'trk_a',
        },
        {
          code: 'custom',
          path: ['source', 'trackIds'],
          message: 'The Track has not completed its Processing',
          reason: 'TRACK_NOT_COMPLETED',
          trackId: 'trk_b',
        },
        {
          code: 'custom',
          path: ['source', 'trackIds'],
          message: 'A hero needs a Track with a cover',
          reason: 'TRACK_NO_COVER',
          trackId: 'trk_c',
        },
      ],
    });

    expect(serverEligibilityErrors(error)).toEqual([
      { kind: 'tracks-not-ready', trackIds: ['trk_a', 'trk_b'] },
      { kind: 'hero-needs-cover', trackIds: ['trk_c'] },
    ]);
  });

  it('reports a refused dynamic source without ids', () => {
    const error = validationError({
      location: 'custom',
      issues: [
        {
          code: 'custom',
          path: ['source'],
          message: 'The genre has fewer than 6 eligible Tracks',
          reason: 'SOURCE_INSUFFICIENT',
        },
      ],
    });

    expect(serverEligibilityErrors(error)).toEqual([
      { kind: 'source', trackIds: [] },
    ]);
  });

  it('returns nothing without validation issues', () => {
    expect(
      serverEligibilityErrors(
        new ApiError({ statusCode: 403, code: 'FORBIDDEN', message: 'No' }),
      ),
    ).toEqual([]);
    expect(serverEligibilityErrors(new Error('boom'))).toEqual([]);
  });
});

describe('pinFormFieldLabelKey', () => {
  it('names the tracks field label', () => {
    expect(pinFormFieldLabelKey('trackIdsText')).toBe('trackIds.label');
    expect(pinFormFieldLabelKey('titleEn')).toBe('titleEn.label');
  });
});

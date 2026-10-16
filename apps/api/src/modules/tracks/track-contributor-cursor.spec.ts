import { AppException } from '../../common/errors/app-exception.js';
import {
  decodeTrackContributorCursor,
  encodeTrackContributorCursor,
} from './track-contributor-cursor.js';

const position = {
  contributedAt: '2026-10-01T12:00:00.000Z',
  contributorId: 'contributor-9',
};

const failureOf = (cursor: string): unknown => {
  try {
    decodeTrackContributorCursor(cursor);
  } catch (error) {
    return error;
  }
  return undefined;
};

describe('track contributor cursor', () => {
  it('decodes back to the position it encodes', () => {
    const cursor = encodeTrackContributorCursor(position);

    expect(decodeTrackContributorCursor(cursor)).toEqual(position);
  });

  it('encodes to an opaque base64url string', () => {
    expect(encodeTrackContributorCursor(position)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('refuses a raw contributor ID instead of listing from a random spot', () => {
    expect(failureOf('contributor-9')).toBeInstanceOf(AppException);
    expect(failureOf('contributor-9')).toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('refuses text that is not base64url JSON', () => {
    const notJson = Buffer.from('not json', 'utf8').toString('base64url');

    expect(failureOf(notJson)).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('refuses a tuple of the wrong shape', () => {
    const wrongShape = Buffer.from(
      JSON.stringify(['not-a-date', 'contributor-9']),
      'utf8',
    ).toString('base64url');

    expect(failureOf(wrongShape)).toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('refuses a cursor that is not in its canonical encoding', () => {
    const padded = `${encodeTrackContributorCursor(position)}=`;

    expect(failureOf(padded)).toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

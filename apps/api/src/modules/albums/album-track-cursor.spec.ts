import { AppException } from '../../common/errors/app-exception.js';
import {
  decodeAlbumTrackCursor,
  encodeAlbumTrackCursor,
} from './album-track-cursor.js';

const position = { discPosition: 2, trackPosition: 7, trackId: 'track-9' };

const failureOf = (cursor: string): unknown => {
  try {
    decodeAlbumTrackCursor(cursor);
  } catch (error) {
    return error;
  }
  return undefined;
};

describe('album track cursor', () => {
  it('decodes back to the position it encodes', () => {
    const cursor = encodeAlbumTrackCursor(position);

    expect(decodeAlbumTrackCursor(cursor)).toEqual(position);
  });

  it('encodes to an opaque base64url string', () => {
    expect(encodeAlbumTrackCursor(position)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('refuses a raw track ID instead of listing from a random spot', () => {
    expect(failureOf('track-9')).toBeInstanceOf(AppException);
    expect(failureOf('track-9')).toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('refuses text that is not base64url JSON', () => {
    const notJson = Buffer.from('not json', 'utf8').toString('base64url');

    expect(failureOf(notJson)).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('refuses a tuple of the wrong shape', () => {
    const wrongShape = Buffer.from(
      JSON.stringify([0, 1, 'track-9']),
      'utf8',
    ).toString('base64url');

    expect(failureOf(wrongShape)).toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('refuses a cursor that is not in its canonical encoding', () => {
    const padded = `${encodeAlbumTrackCursor(position)}=`;

    expect(failureOf(padded)).toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

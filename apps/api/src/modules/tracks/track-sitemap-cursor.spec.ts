import {
  decodeTrackSitemapCursor,
  encodeTrackSitemapCursor,
} from './track-sitemap-cursor.js';

describe('track sitemap cursor', () => {
  it('decodes what it encoded', () => {
    const cursor = { score: 42, trackId: 'track-1' };

    expect(decodeTrackSitemapCursor(encodeTrackSitemapCursor(cursor))).toEqual(
      cursor,
    );
  });

  it.each([
    ['a raw Track ID', 'track-1'],
    ['not JSON', Buffer.from('nope').toString('base64url')],
    [
      'the wrong shape',
      Buffer.from(JSON.stringify(['x', 1])).toString('base64url'),
    ],
    [
      'a negative score',
      Buffer.from(JSON.stringify([-1, 'track-1'])).toString('base64url'),
    ],
    [
      'a non-canonical encoding',
      Buffer.from(JSON.stringify([1, 'track-1'], null, 1)).toString(
        'base64url',
      ),
    ],
  ])('refuses %s', (_name, cursor) => {
    expect(() => decodeTrackSitemapCursor(cursor)).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    );
  });
});

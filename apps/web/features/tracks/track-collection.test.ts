import { describe, expect, it } from 'vitest';

import { TRACK_PAGE_SIZE, trackCollectionPath } from './track-collection';

describe('trackCollectionPath', () => {
  it.each([
    [{ kind: 'artist', id: 'clx456def' }, '/artists/clx456def'],
    [{ kind: 'album', id: 'clx789ghi' }, '/albums/clx789ghi'],
  ] as const)('builds the path of %o', (collection, path) => {
    expect(trackCollectionPath(collection)).toBe(path);
  });

  it('escapes the ID so it stays one path segment', () => {
    expect(trackCollectionPath({ kind: 'artist', id: 'a/b?c' })).toBe(
      '/artists/a%2Fb%3Fc',
    );
  });
});

describe('TRACK_PAGE_SIZE', () => {
  it('fills every grid row, whatever the column count', () => {
    for (const columns of [2, 3, 4, 6]) {
      expect(TRACK_PAGE_SIZE % columns).toBe(0);
    }
  });
});

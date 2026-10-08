import { describe, expect, it } from 'vitest';

import { albumKeys } from './query-keys';

describe('albumKeys', () => {
  it('builds stable keys per album', () => {
    expect(albumKeys.tracks('album-1')).toEqual([
      'albums',
      'album-1',
      'tracks',
    ]);
  });

  it('separates infinite keys by album and limit', () => {
    expect(albumKeys.infiniteTracks('album-1', 20)).toEqual([
      'albums',
      'album-1',
      'tracks',
      'infinite',
      { limit: 20 },
    ]);
    expect(albumKeys.infiniteTracks('album-1', 20)).not.toEqual(
      albumKeys.infiniteTracks('album-2', 20),
    );
  });
});

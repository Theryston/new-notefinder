import { describe, expect, it } from 'vitest';

import { artistKeys } from './query-keys';

describe('artistKeys', () => {
  it('builds stable keys per artist', () => {
    expect(artistKeys.tracks('artist-1')).toEqual([
      'artists',
      'artist-1',
      'tracks',
    ]);
  });

  it('separates infinite keys by artist and limit', () => {
    expect(artistKeys.infiniteTracks('artist-1', 20)).toEqual([
      'artists',
      'artist-1',
      'tracks',
      'infinite',
      { limit: 20 },
    ]);
    expect(artistKeys.infiniteTracks('artist-1', 20)).not.toEqual(
      artistKeys.infiniteTracks('artist-2', 20),
    );
  });
});

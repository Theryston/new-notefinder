import { describe, expect, it } from 'vitest';

import { profileKeys } from './query-keys';

describe('profileKeys', () => {
  it('builds stable keys per Profile', () => {
    expect(profileKeys.favorites('ada_lovelace')).toEqual([
      'users',
      'ada_lovelace',
      'favorites',
    ]);
  });

  it('separates infinite keys by Profile and page size', () => {
    expect(profileKeys.infiniteFavorites('ada_lovelace', 20)).toEqual([
      'users',
      'ada_lovelace',
      'favorites',
      'infinite',
      { limit: 20 },
    ]);
    expect(profileKeys.infiniteFavorites('ada_lovelace', 20)).not.toEqual(
      profileKeys.infiniteFavorites('grace', 20),
    );
  });
});

import { describe, expect, it } from 'vitest';

import { offersTrackRequest } from './search-result-action';

const signedIn = { username: 'ada' };

describe('offersTrackRequest', () => {
  it('offers the request for a Recording with no Track, to a signed-in User with a username', () => {
    expect(offersTrackRequest({ trackId: null }, signedIn)).toBe(true);
  });

  it('keeps a Recording that already has a Track a plain link for everyone', () => {
    expect(offersTrackRequest({ trackId: 'track-1' }, signedIn)).toBe(false);
  });

  it('keeps a static card for a signed-out visitor', () => {
    expect(offersTrackRequest({ trackId: null }, null)).toBe(false);
  });

  it('keeps a static card while the username is still missing', () => {
    expect(offersTrackRequest({ trackId: null }, { username: null })).toBe(
      false,
    );
  });
});

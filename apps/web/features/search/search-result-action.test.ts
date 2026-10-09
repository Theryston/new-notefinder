import { describe, expect, it } from 'vitest';

import { signInToRequestHref } from './request-sign-in';
import {
  offersSignInToRequest,
  offersTrackRequest,
} from './search-result-action';

const signedIn = { username: 'ada' };
const MBID = '00000000-0000-4000-8000-000000000002';

describe('offersTrackRequest', () => {
  it('offers the request for a Recording with no Track, to a signed-in User with a username', () => {
    expect(offersTrackRequest({ trackId: null }, signedIn)).toBe(true);
  });

  it('keeps a Recording that already has a Track a plain link for everyone', () => {
    expect(offersTrackRequest({ trackId: 'track-1' }, signedIn)).toBe(false);
  });

  it('offers a sign-in link, not a request, to a signed-out visitor', () => {
    expect(offersTrackRequest({ trackId: null }, null)).toBe(false);
    expect(offersSignInToRequest({ trackId: null }, null)).toBe(true);
    expect(signInToRequestHref('/search?q=queen', MBID)).toEqual({
      pathname: '/sign-in',
      query: { redirectTo: `/search?q=queen&process=${MBID}` },
    });
  });

  it('keeps a static card while the username is still missing', () => {
    expect(offersTrackRequest({ trackId: null }, { username: null })).toBe(
      false,
    );
  });
});

import { describe, expect, it } from 'vitest';

import {
  offersSignInToRequest,
  searchPathFrom,
  searchPathWithRequest,
  signInToRequestHref,
} from './request-sign-in';

const MBID = '00000000-0000-4000-8000-000000000002';

describe('searchPathFrom', () => {
  it('keeps the query and scope the URL has', () => {
    expect(searchPathFrom('queen', 'lyrics')).toBe(
      '/search?q=queen&scope=lyrics',
    );
  });

  it('is the bare search path without a query', () => {
    expect(searchPathFrom(null, null)).toBe('/search');
  });
});

describe('searchPathWithRequest', () => {
  it('adds the marker to the search, keeping its query', () => {
    expect(searchPathWithRequest('/search?q=queen', MBID)).toBe(
      `/search?q=queen&process=${MBID}`,
    );
  });

  it('adds the marker to a search without a query', () => {
    expect(searchPathWithRequest('/search', MBID)).toBe(
      `/search?process=${MBID}`,
    );
  });

  it('replaces a marker that is already there instead of doubling it', () => {
    expect(
      searchPathWithRequest(`/search?q=queen&process=${MBID}`, '1'.repeat(8)),
    ).toBe(`/search?q=queen&process=${'1'.repeat(8)}`);
  });
});

describe('signInToRequestHref', () => {
  it('goes to sign-in with redirectTo set to the search and its marker', () => {
    expect(signInToRequestHref('/search?q=queen', MBID)).toEqual({
      pathname: '/sign-in',
      query: { redirectTo: `/search?q=queen&process=${MBID}` },
    });
  });

  it('keeps the scope of the search in the redirect', () => {
    const { query } = signInToRequestHref('/search?q=queen&scope=lyrics', MBID);

    expect(query.redirectTo).toBe(
      `/search?q=queen&scope=lyrics&process=${MBID}`,
    );
  });
});

describe('offersSignInToRequest', () => {
  it('offers the sign-in for a Recording with no Track, to a signed-out visitor', () => {
    expect(offersSignInToRequest({ trackId: null }, null)).toBe(true);
  });

  it('leaves a Recording that already has a Track a plain link', () => {
    expect(offersSignInToRequest({ trackId: 'track-1' }, null)).toBe(false);
  });

  it('is not a sign-in when the visitor is signed in', () => {
    expect(offersSignInToRequest({ trackId: null }, { username: 'ada' })).toBe(
      false,
    );
  });
});

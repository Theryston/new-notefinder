import { describe, expect, it } from 'vitest';

import { headerFieldLoading } from './header-search-loading';

describe('headerFieldLoading', () => {
  it('spins on the search page while the typed text is not yet in the URL', () => {
    expect(
      headerFieldLoading({
        isSearchPage: true,
        inputValue: 'queen live',
        urlQuery: 'queen',
        fetching: false,
      }),
    ).toBe(true);
  });

  it('stops spinning on the search page once the URL matches the field', () => {
    expect(
      headerFieldLoading({
        isSearchPage: true,
        inputValue: '  queen ',
        urlQuery: 'queen',
        fetching: false,
      }),
    ).toBe(false);
  });

  it('does not spin off the search page just because the field has text', () => {
    expect(
      headerFieldLoading({
        isSearchPage: false,
        inputValue: 'queen',
        urlQuery: null,
        fetching: false,
      }),
    ).toBe(false);
  });

  it('spins while any search request is in flight, wherever the page is', () => {
    expect(
      headerFieldLoading({
        isSearchPage: false,
        inputValue: 'queen',
        urlQuery: null,
        fetching: true,
      }),
    ).toBe(true);
  });
});

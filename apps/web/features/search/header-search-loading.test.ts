import { describe, expect, it } from 'vitest';

import { headerFieldLoading } from './header-search-loading';

const off = (overrides: Partial<Parameters<typeof headerFieldLoading>[0]>) =>
  headerFieldLoading({
    isSearchPage: false,
    inputValue: '',
    urlQuery: null,
    debouncedQuery: '',
    fetching: false,
    ...overrides,
  });

describe('headerFieldLoading off the search page', () => {
  it('spins from the first keystroke, before the debounce catches up', () => {
    expect(off({ inputValue: 'q', debouncedQuery: '' })).toBe(true);
  });

  it('spins while the suggestions lag a longer typed text', () => {
    expect(off({ inputValue: 'queen live', debouncedQuery: 'queen' })).toBe(
      true,
    );
  });

  it('spins while the suggestions fetch runs', () => {
    expect(
      off({ inputValue: 'queen', debouncedQuery: 'queen', fetching: true }),
    ).toBe(true);
  });

  it('stops once the suggestions have caught up, even with the list closed', () => {
    expect(off({ inputValue: 'queen', debouncedQuery: 'queen' })).toBe(false);
  });

  it('compares the normalized text, so spacing alone does not spin', () => {
    expect(off({ inputValue: '  queen ', debouncedQuery: 'queen' })).toBe(
      false,
    );
  });

  it('never spins for a blank field, even while a clear is still debounced', () => {
    expect(off({ inputValue: '', debouncedQuery: 'queen' })).toBe(false);
    expect(
      off({ inputValue: '   ', debouncedQuery: 'queen', fetching: true }),
    ).toBe(false);
  });

  it('does not spin for the URL, which off the page never follows typing', () => {
    expect(
      off({ inputValue: 'queen', urlQuery: null, debouncedQuery: 'queen' }),
    ).toBe(false);
  });
});

describe('headerFieldLoading on the search page', () => {
  it('spins while the typed text is not yet in the URL', () => {
    expect(
      headerFieldLoading({
        isSearchPage: true,
        inputValue: 'queen live',
        urlQuery: 'queen',
        debouncedQuery: 'queen live',
        fetching: false,
      }),
    ).toBe(true);
  });

  it('stops spinning once the URL matches the field', () => {
    expect(
      headerFieldLoading({
        isSearchPage: true,
        inputValue: '  queen ',
        urlQuery: 'queen',
        debouncedQuery: 'queen',
        fetching: false,
      }),
    ).toBe(false);
  });

  it('spins while a search request is in flight', () => {
    expect(
      headerFieldLoading({
        isSearchPage: true,
        inputValue: 'queen',
        urlQuery: 'queen',
        debouncedQuery: 'queen',
        fetching: true,
      }),
    ).toBe(true);
  });
});

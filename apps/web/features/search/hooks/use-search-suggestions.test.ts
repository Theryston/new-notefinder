import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env/client', () => ({
  getClientEnv: () => ({ NEXT_PUBLIC_API_URL: 'https://api.test' }),
}));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

describe('searchSuggestionsQueryOptions', () => {
  it('asks the public endpoint with metadata scope and a limit of 6', async () => {
    fetchMock.mockResolvedValue(Response.json({ results: [] }));
    const { searchSuggestionsQueryOptions } = await import(
      './use-search-suggestions'
    );
    const queryClient = new QueryClient();

    await queryClient.fetchQuery(
      searchSuggestionsQueryOptions({ query: 'queen' }),
    );

    const [input] = fetchMock.mock.lastCall ?? [];
    const url = new URL(String(input));
    expect(url.pathname).toBe('/v1/search');
    expect(url.searchParams.get('query')).toBe('queen');
    expect(url.searchParams.get('scope')).toBe('metadata');
    expect(url.searchParams.get('limit')).toBe('6');
    expect(url.searchParams.get('offset')).toBe('0');
  });

  it('keys suggestions apart from the infinite results', async () => {
    const { searchSuggestionsQueryOptions } = await import(
      './use-search-suggestions'
    );
    const { searchKeys } = await import('../query-keys');
    const { searchInfiniteQueryOptions } = await import('./use-search-results');

    const options = searchSuggestionsQueryOptions({ query: 'queen' });

    expect(options.queryKey).toEqual([
      'search',
      'suggestions',
      { query: 'queen', scope: 'metadata', limit: 6 },
    ]);
    expect(options.queryKey).toEqual(searchKeys.suggestions('queen'));
    expect(options.queryKey).not.toEqual(
      searchInfiniteQueryOptions({
        query: 'queen',
        scope: 'metadata',
        limit: 6,
      }).queryKey,
    );
  });

  it('stays disabled while the query is not searchable', async () => {
    const { searchSuggestionsQueryOptions } = await import(
      './use-search-suggestions'
    );

    expect(searchSuggestionsQueryOptions({ query: ' ' })).toMatchObject({
      enabled: false,
    });
    expect(searchSuggestionsQueryOptions({ query: '' })).toMatchObject({
      enabled: false,
    });
    expect(searchSuggestionsQueryOptions({ query: 'queen' })).toMatchObject({
      enabled: true,
    });
  });

  it('keys every blank the same while disabled', async () => {
    const { searchSuggestionsQueryOptions } = await import(
      './use-search-suggestions'
    );

    const blank = searchSuggestionsQueryOptions({ query: ' ' }).queryKey;
    const blanker = searchSuggestionsQueryOptions({ query: '   ' }).queryKey;

    expect(blank).toEqual(blanker);
    expect(blank).toEqual([
      'search',
      'suggestions',
      { query: '', scope: 'metadata', limit: 6 },
    ]);
  });

  it('exposes the header hook over the options', async () => {
    const { useSearchSuggestions } = await import('./use-search-suggestions');

    // The header autocomplete UI consumes the hook; pinned here so the
    // export stays referenced while that UI lands.
    expect(useSearchSuggestions).toBeDefined();
  });
});

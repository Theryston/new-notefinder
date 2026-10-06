import { SEARCH_DEFAULT_LIMIT } from '@notefinder/contracts';
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env/client', () => ({
  getClientEnv: () => ({ NEXT_PUBLIC_API_URL: 'https://api.test' }),
}));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

function searchBody(results: unknown[]) {
  return Response.json({ results });
}

const mbid = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function resultItem(n: number, title: string, trackId: string | null = null) {
  return {
    mbid: mbid(n),
    title,
    lengthMs: null,
    disambiguation: '',
    video: false,
    artistCredit: { name: 'Artist', artists: [] },
    genres: [],
    primaryRelease: null,
    trackId,
  };
}

describe('fetchSearchPage', () => {
  it('asks the public endpoint with query plus scope and paging', async () => {
    fetchMock.mockResolvedValue(searchBody([resultItem(1, 'Song')]));
    const { fetchSearchPage } = await import('./use-search-results');

    const page = await fetchSearchPage({
      query: 'queen',
      scope: 'lyrics',
      limit: 20,
      offset: 20,
    });

    const [input] = fetchMock.mock.lastCall ?? [];
    const url = new URL(String(input));
    expect(url.pathname).toBe('/v1/search');
    expect(url.searchParams.get('query')).toBe('queen');
    expect(url.searchParams.get('scope')).toBe('lyrics');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.get('offset')).toBe('20');
    expect(page.results).toHaveLength(1);
  });

  it('aborts superseded fetches', async () => {
    fetchMock.mockImplementation(
      (...args: Parameters<typeof fetch>) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = (args[1] as RequestInit | undefined)?.signal;
          if (signal instanceof AbortSignal) {
            signal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }
        }),
    );
    const { fetchSearchPage } = await import('./use-search-results');
    const controller = new AbortController();

    const pending = fetchSearchPage({
      query: 'queen',
      scope: 'metadata',
      limit: 20,
      offset: 0,
      signal: controller.signal,
    });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('searchInfiniteQueryOptions', () => {
  it('fetches the first page through the query client', async () => {
    fetchMock.mockResolvedValue(searchBody([resultItem(1, 'Song')]));
    const { searchInfiniteQueryOptions } = await import('./use-search-results');
    const queryClient = new QueryClient();

    const data = await queryClient.fetchInfiniteQuery(
      searchInfiniteQueryOptions({ query: 'queen', scope: 'metadata' }),
    );

    expect(data.pages).toHaveLength(1);
    expect(data.pages[0]?.results.map((item) => item.title)).toEqual(['Song']);
  });

  it('stays disabled below 2 non-blank characters', async () => {
    const { searchInfiniteQueryOptions } = await import('./use-search-results');

    expect(
      searchInfiniteQueryOptions({ query: ' ', scope: 'metadata' }),
    ).toMatchObject({ enabled: false });
    expect(
      searchInfiniteQueryOptions({ query: 'queen', scope: 'metadata' }),
    ).toMatchObject({ enabled: true });
  });

  it('keys every blank the same while disabled', async () => {
    const { searchInfiniteQueryOptions } = await import('./use-search-results');

    expect(
      searchInfiniteQueryOptions({ query: ' ', scope: 'metadata' }).queryKey,
    ).toEqual(
      searchInfiniteQueryOptions({ query: '   ', scope: 'metadata' }).queryKey,
    );
  });

  it('pages while full pages arrive and stops on a short one', async () => {
    const { searchInfiniteQueryOptions } = await import('./use-search-results');
    const options = searchInfiniteQueryOptions({
      query: 'queen',
      scope: 'metadata',
      limit: 2,
    });

    const full = { results: [resultItem(1, 'A'), resultItem(2, 'B')] };
    const short = { results: [resultItem(3, 'C')] };
    expect(options.getNextPageParam?.(full, [full], 0, [0])).toBe(2);
    expect(
      options.getNextPageParam?.(short, [full, short], 2, [0, 2]),
    ).toBeUndefined();
  });

  it('uses the default page size', async () => {
    const { searchInfiniteQueryOptions } = await import('./use-search-results');
    const options = searchInfiniteQueryOptions({
      query: 'queen',
      scope: 'metadata',
    });

    expect(options.queryKey).toEqual([
      'search',
      'infinite',
      { query: 'queen', scope: 'metadata', limit: SEARCH_DEFAULT_LIMIT },
    ]);
  });
});

// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  pinTrackSearchQueryOptions,
  pinTrackSummariesQueryOptions,
} from '../admin-pins-query';
import {
  usePinTrackSearch,
  usePinTrackSummaries,
} from './use-pin-track-search';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/env/client', () => ({
  getClientEnv: () => ({ NEXT_PUBLIC_API_URL: 'https://api.test' }),
}));

const apiFetch = vi.fn<typeof fetch>();

const pickTrack = (id: string) => ({
  id,
  title: `Song ${id}`,
  artistCredit: [{ name: `Artist ${id}`, joinPhrase: '' }],
  coverUrl: `https://cdn.example/${id}.webp`,
});

const trackPageOf = (ids: string[]) =>
  Response.json({ items: ids.map(pickTrack) });

beforeEach(() => {
  apiFetch.mockReset();
  vi.stubGlobal('fetch', apiFetch);
  vi.useRealTimers();
});

const lastSearchUrl = () => {
  const [input] = apiFetch.mock.lastCall ?? [];
  return new URL(String(input));
};

/** Mounts an element with its own query client. */
async function mountTree(element: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client: queryClient }, element),
    );
  });
  return {
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('pin track search queries', () => {
  it('asks the admin tracks endpoint with the kind and a limit of 10', async () => {
    apiFetch.mockResolvedValue(trackPageOf([]));
    const queryClient = new QueryClient();

    await queryClient.fetchQuery(pinTrackSearchQueryOptions('summer', 'row'));

    const url = lastSearchUrl();
    expect(url.pathname).toBe('/v1/admin/tracks/search');
    expect(url.searchParams.get('q')).toBe('summer');
    expect(url.searchParams.get('kind')).toBe('row');
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('asks for the summaries of the picked ids in order', async () => {
    apiFetch.mockResolvedValue(trackPageOf(['b']));
    const queryClient = new QueryClient();

    const page = await queryClient.fetchQuery(
      pinTrackSummariesQueryOptions(['b', 'a']),
    );

    expect(lastSearchUrl().searchParams.get('ids')).toBe('b,a');
    expect(page.items.map((item) => item.id)).toEqual(['b']);
  });
});

describe('usePinTrackSearch', () => {
  it('fetches on the debounce with the latest query and kind', async () => {
    vi.useFakeTimers();
    try {
      apiFetch.mockResolvedValue(trackPageOf(['trk_a']));
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      function Harness({ query }: { query: string }) {
        usePinTrackSearch(query, 'hero');
        return null;
      }
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      try {
        const show = (query: string) =>
          act(async () => {
            root.render(
              createElement(
                QueryClientProvider,
                { client: queryClient },
                createElement(Harness, { query }),
              ),
            );
          });

        await show('s');
        await show('su');
        await act(async () => {
          await vi.advanceTimersByTimeAsync(299);
        });
        expect(apiFetch).not.toHaveBeenCalled();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1);
        });
        expect(apiFetch).toHaveBeenCalledTimes(1);
        const url = lastSearchUrl();
        expect(url.searchParams.get('q')).toBe('su');
        expect(url.searchParams.get('kind')).toBe('hero');
      } finally {
        await act(async () => {
          root.unmount();
        });
        container.remove();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not fetch while the query is too short', async () => {
    vi.useFakeTimers();
    try {
      apiFetch.mockResolvedValue(trackPageOf([]));
      function Harness() {
        usePinTrackSearch('a', 'row');
        return null;
      }
      const { unmount } = await mountTree(createElement(Harness));
      try {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
        expect(apiFetch).not.toHaveBeenCalled();
      } finally {
        await unmount();
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('usePinTrackSummaries', () => {
  it('stays disabled without picked ids', async () => {
    function Harness() {
      usePinTrackSummaries([]);
      return null;
    }
    const { unmount } = await mountTree(createElement(Harness));
    try {
      expect(apiFetch).not.toHaveBeenCalled();
    } finally {
      await unmount();
    }
  });
});

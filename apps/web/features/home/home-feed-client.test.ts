import { homeFeedPageSchema } from '@notefinder/contracts';
import { describe, expect, it, vi } from 'vitest';
import { fetchHomePageInBrowser } from './home-feed-client';

const browserApi = vi.fn();

vi.mock('@/lib/api/browser', () => ({
  browserApi: (...args: unknown[]) => browserApi(...args),
}));

describe('fetchHomePageInBrowser', () => {
  it('asks the API for the locale and cursor, parsed with the feed page schema', async () => {
    const signal = new AbortController().signal;
    browserApi.mockResolvedValue({ rows: [] });

    await fetchHomePageInBrowser({ locale: 'pt-BR', cursor: 'v.6', signal });

    expect(browserApi).toHaveBeenCalledWith('/home', {
      schema: homeFeedPageSchema,
      query: { locale: 'pt-BR', cursor: 'v.6' },
      signal,
    });
  });

  it('asks for the first page when there is no cursor', async () => {
    const signal = new AbortController().signal;

    await fetchHomePageInBrowser({ locale: 'en', cursor: undefined, signal });

    expect(browserApi).toHaveBeenCalledWith(
      '/home',
      expect.objectContaining({ query: { locale: 'en', cursor: undefined } }),
    );
  });
});

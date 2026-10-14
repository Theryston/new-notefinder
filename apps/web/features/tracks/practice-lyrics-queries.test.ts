import { cacheTag } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browserApi } from '@/lib/api/browser';
import { serverApi } from '@/lib/api/server';

import { getInitialLyrics } from './practice-queries';
import { trackLyricsQueryOptions } from './track-practice-query';

vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));
vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const mockServerApi = vi.mocked(serverApi);
const mockBrowserApi = vi.mocked(browserApi);
const signal = new AbortController().signal;

const lyrics = {
  lines: [{ start: 1, end: 2, words: [{ text: 'Hello', start: 1, end: 2 }] }],
};

describe('getInitialLyrics', () => {
  beforeEach(() => {
    mockServerApi.mockReset();
    vi.mocked(cacheTag).mockReset();
  });

  it('reads the lyrics under their own cache tag', async () => {
    mockServerApi.mockResolvedValue(lyrics);

    await expect(getInitialLyrics('a/b')).resolves.toEqual(lyrics);

    expect(mockServerApi).toHaveBeenCalledWith('/tracks/a%2Fb/lyrics', {
      schema: expect.anything(),
    });
    expect(vi.mocked(cacheTag).mock.calls).toEqual([['track:a/b:lyrics']]);
  });

  it('is undefined when the API fails, so the page still renders', async () => {
    mockServerApi.mockRejectedValue(new Error('API down'));

    await expect(getInitialLyrics('track-1')).resolves.toBeUndefined();
  });
});

describe('trackLyricsQueryOptions', () => {
  it('reads the lyrics from the browser, keyed by Track', async () => {
    const options = trackLyricsQueryOptions('a/b', undefined);
    mockBrowserApi.mockResolvedValue(lyrics);

    await options.queryFn?.({ signal } as never);

    expect(options.queryKey).toEqual(['tracks', 'a/b', 'lyrics']);
    expect(mockBrowserApi).toHaveBeenCalledWith('/tracks/a%2Fb/lyrics', {
      schema: expect.anything(),
      signal,
    });
  });

  it('starts from what the server rendered', () => {
    expect(trackLyricsQueryOptions('t', lyrics).initialData).toBe(lyrics);
  });
});

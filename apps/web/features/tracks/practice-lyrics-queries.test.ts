import { cacheTag } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browserApi } from '@/lib/api/browser';
import { serverApi } from '@/lib/api/server';

import { getInitialPracticeWithLyrics } from './practice-queries';
import { trackLyricsQueryOptions } from './track-practice-query';

vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));
vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const mockServerApi = vi.mocked(serverApi);
const mockBrowserApi = vi.mocked(browserApi);
const signal = new AbortController().signal;

const header = {
  id: 'a/b',
  title: 'Under Pressure',
  coverUrl: null,
  artistCredit: [],
  durationMs: 248_000,
  youtubeVideoId: null,
  contributors: [],
  hasNotes: true,
};
const notes = { notes: [{ pitch: 60, start: 0, end: 1 }] };
const lyrics = {
  lines: [{ start: 1, end: 2, words: [{ text: 'Hello', start: 1, end: 2 }] }],
};

/** Answers each Track read by its path, whatever order they are asked in. */
const answerWith = (answers: Record<string, unknown>) =>
  mockServerApi.mockImplementation(((path: string) => {
    const answer = answers[path];
    return answer instanceof Error
      ? Promise.reject(answer)
      : Promise.resolve(answer);
  }) as never);

describe('getInitialPracticeWithLyrics', () => {
  beforeEach(() => {
    mockServerApi.mockReset();
    vi.mocked(cacheTag).mockReset();
  });

  it('adds the lyrics, cached under their own tag, to the header and notes', async () => {
    answerWith({
      '/tracks/a%2Fb': header,
      '/tracks/a%2Fb/notes': notes,
      '/tracks/a%2Fb/lyrics': lyrics,
    });

    await expect(getInitialPracticeWithLyrics('a/b')).resolves.toEqual({
      header,
      notes,
      lyrics,
    });

    expect(vi.mocked(cacheTag).mock.calls).toContainEqual(['track:a/b:lyrics']);
  });

  it('keeps the page when only the lyrics fail', async () => {
    answerWith({
      '/tracks/a%2Fb': header,
      '/tracks/a%2Fb/notes': notes,
      '/tracks/a%2Fb/lyrics': new Error('API down'),
    });

    await expect(getInitialPracticeWithLyrics('a/b')).resolves.toEqual({
      header,
      notes,
      lyrics: undefined,
    });
  });

  it('is undefined when the header cannot be read', async () => {
    mockServerApi.mockRejectedValue(new Error('API down'));

    await expect(getInitialPracticeWithLyrics('a/b')).resolves.toBeUndefined();
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

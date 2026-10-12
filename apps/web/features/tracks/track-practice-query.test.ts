import { describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import {
  trackNotesQueryOptions,
  trackPracticeQueryOptions,
} from './track-practice-query';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const mockBrowserApi = vi.mocked(browserApi);
const signal = new AbortController().signal;

describe('trackPracticeQueryOptions', () => {
  it('reads the header from the browser, keyed by Track', async () => {
    const options = trackPracticeQueryOptions('a/b', undefined);
    mockBrowserApi.mockResolvedValue({ id: 'a/b' });

    await options.queryFn?.({ signal } as never);

    expect(options.queryKey).toEqual(['tracks', 'a/b', 'practice']);
    expect(mockBrowserApi).toHaveBeenCalledWith('/tracks/a%2Fb', {
      schema: expect.anything(),
      signal,
    });
  });
});

describe('trackNotesQueryOptions', () => {
  it('reads the notes from the browser, keyed by Track', async () => {
    const options = trackNotesQueryOptions('a/b', true, undefined);
    mockBrowserApi.mockResolvedValue({ notes: [] });

    await options.queryFn?.({ signal } as never);

    expect(options.queryKey).toEqual(['tracks', 'a/b', 'notes']);
    expect(options.enabled).toBe(true);
    expect(mockBrowserApi).toHaveBeenCalledWith('/tracks/a%2Fb/notes', {
      schema: expect.anything(),
      signal,
    });
  });

  it('waits for the header to say there are notes', () => {
    expect(trackNotesQueryOptions('t', false, undefined).enabled).toBe(false);
  });
});

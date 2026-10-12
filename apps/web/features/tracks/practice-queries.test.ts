import { cacheTag } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { serverApi } from '@/lib/api/server';

import { getInitialPractice } from './practice-queries';

vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
// The queries read through the server API client, which is server-only.
vi.mock('server-only', () => ({}));
vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));

const mockServerApi = vi.mocked(serverApi);

const header = {
  id: 'track-1',
  title: 'Under Pressure',
  coverUrl: null,
  artistCredit: [],
  durationMs: 248_000,
  youtubeVideoId: null,
  contributors: [],
  hasNotes: true,
};

const notes = { notes: [{ note: 'C', octave: 4, start: 0, end: 1 }] };

describe('getInitialPractice', () => {
  beforeEach(() => {
    mockServerApi.mockReset();
    vi.mocked(cacheTag).mockReset();
  });

  it('reads the header and the notes, each under its own cache tag', async () => {
    mockServerApi.mockResolvedValueOnce(header).mockResolvedValueOnce(notes);

    await expect(getInitialPractice('track-1')).resolves.toEqual({
      header,
      notes,
    });

    expect(mockServerApi).toHaveBeenNthCalledWith(1, '/tracks/track-1', {
      schema: expect.anything(),
    });
    expect(mockServerApi).toHaveBeenNthCalledWith(2, '/tracks/track-1/notes', {
      schema: expect.anything(),
    });
    expect(vi.mocked(cacheTag).mock.calls).toEqual([
      ['track:track-1'],
      ['track:track-1:notes'],
    ]);
  });

  it('does not ask for the notes of a Track that has none', async () => {
    mockServerApi.mockResolvedValueOnce({ ...header, hasNotes: false });

    await expect(getInitialPractice('track-1')).resolves.toEqual({
      header: { ...header, hasNotes: false },
      notes: undefined,
    });

    expect(mockServerApi).toHaveBeenCalledTimes(1);
  });

  it('encodes the ID in the request paths', async () => {
    mockServerApi.mockResolvedValueOnce(header).mockResolvedValueOnce(notes);

    await getInitialPractice('a/b c');

    expect(mockServerApi.mock.calls.map(([path]) => path)).toEqual([
      '/tracks/a%2Fb%20c',
      '/tracks/a%2Fb%20c/notes',
    ]);
  });

  it('is undefined when the API fails, so the browser can read it on its own', async () => {
    mockServerApi.mockRejectedValue(new Error('API down'));

    await expect(getInitialPractice('track-1')).resolves.toBeUndefined();
  });
});

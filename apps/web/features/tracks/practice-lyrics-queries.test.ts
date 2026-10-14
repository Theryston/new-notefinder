import { cacheTag } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { serverApi } from '@/lib/api/server';

import { getInitialLyrics } from './practice-queries';

vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));

const mockServerApi = vi.mocked(serverApi);

describe('getInitialLyrics', () => {
  beforeEach(() => {
    mockServerApi.mockReset();
    vi.mocked(cacheTag).mockReset();
  });

  it('reads lyrics through the Track lyrics cache tag', async () => {
    const lyrics = { lines: [] };
    mockServerApi.mockResolvedValue(lyrics);

    await expect(getInitialLyrics('track-1')).resolves.toEqual(lyrics);

    expect(mockServerApi).toHaveBeenCalledWith('/tracks/track-1/lyrics', {
      schema: expect.anything(),
    });
    expect(vi.mocked(cacheTag)).toHaveBeenCalledWith('track:track-1:lyrics');
  });

  it('lets the browser retry if the server cannot read lyrics', async () => {
    mockServerApi.mockRejectedValue(new Error('API down'));

    await expect(getInitialLyrics('track-1')).resolves.toBeUndefined();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
// `queries.ts` reads through the server API client, which is server-only.
vi.mock('server-only', () => ({}));

const { serverApi } = await import('@/lib/api/server');
vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));

const mockServerApi = vi.mocked(serverApi);

const loadQueries = async () => {
  const module = await import('./queries');
  return module.getArtistResult;
};

const artist = {
  id: 'artist-1',
  mbid: '00000000-0000-4000-8000-000000001001',
  name: 'Queen',
  genres: ['rock'],
  trackCount: 2,
};

describe('getArtistResult', () => {
  beforeEach(() => {
    vi.resetModules();
    mockServerApi.mockReset();
  });

  it('returns the cached header detail', async () => {
    mockServerApi.mockResolvedValue(artist);
    const getArtistResult = await loadQueries();

    await expect(getArtistResult('artist-1')).resolves.toEqual({
      status: 'found',
      artist,
    });
    expect(mockServerApi).toHaveBeenCalledWith('/artists/artist-1', {
      schema: expect.anything(),
    });
  });

  it('maps a legacy ID to its redirect', async () => {
    mockServerApi.mockRejectedValue(
      new ApiError({
        statusCode: 404,
        code: 'RESOURCE_MOVED',
        message: 'Artist moved',
        details: { id: 'artist-1' },
      }),
    );
    const getArtistResult = await loadQueries();

    await expect(getArtistResult('legacy-1')).resolves.toEqual({
      status: 'moved',
      newId: 'artist-1',
    });
  });

  it('maps an unknown ID to a real 404', async () => {
    mockServerApi.mockRejectedValue(
      new ApiError({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Artist not found',
      }),
    );
    const getArtistResult = await loadQueries();

    await expect(getArtistResult('missing')).resolves.toEqual({
      status: 'missing',
    });
  });

  it('rethows genuine failures', async () => {
    const failure = new ApiError({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Broken',
    });
    mockServerApi.mockRejectedValue(failure);
    const getArtistResult = await loadQueries();

    await expect(getArtistResult('artist-1')).rejects.toBe(failure);
  });
});

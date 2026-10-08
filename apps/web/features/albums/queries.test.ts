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
  return module.getAlbumResult;
};

const album = {
  id: 'album-1',
  mbid: '00000000-0000-4000-8000-00000000a001',
  title: 'A Night at the Opera',
  primaryType: 'Album',
  secondaryTypes: [],
  year: 1975,
  genres: ['rock'],
  coverArtUrl: null,
  artists: [{ id: 'artist-1', name: 'Queen' }],
};

describe('getAlbumResult', () => {
  beforeEach(() => {
    vi.resetModules();
    mockServerApi.mockReset();
  });

  it('returns the cached album header detail', async () => {
    mockServerApi.mockResolvedValue(album);
    const getAlbumResult = await loadQueries();

    await expect(getAlbumResult('album-1')).resolves.toEqual({
      status: 'found',
      album,
    });
    expect(mockServerApi).toHaveBeenCalledWith('/albums/album-1', {
      schema: expect.anything(),
    });
  });

  it('encodes the ID in the request path', async () => {
    mockServerApi.mockResolvedValue(album);
    const getAlbumResult = await loadQueries();

    await getAlbumResult('album/with space');

    expect(mockServerApi).toHaveBeenCalledWith('/albums/album%2Fwith%20space', {
      schema: expect.anything(),
    });
  });

  it('turns a legacy ID into a moved outcome', async () => {
    mockServerApi.mockRejectedValue(
      new ApiError({
        statusCode: 404,
        code: 'RESOURCE_MOVED',
        message: 'Album moved',
        details: { id: 'album-1' },
      }),
    );
    const getAlbumResult = await loadQueries();

    await expect(getAlbumResult('legacy-1')).resolves.toEqual({
      status: 'moved',
      newId: 'album-1',
    });
  });

  it('turns an unknown ID into a missing outcome', async () => {
    mockServerApi.mockRejectedValue(
      new ApiError({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Album not found',
      }),
    );
    const getAlbumResult = await loadQueries();

    await expect(getAlbumResult('unknown')).resolves.toEqual({
      status: 'missing',
    });
  });

  it('rethrows a genuine failure so the page shows an error', async () => {
    const failure = new ApiError({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'boom',
    });
    mockServerApi.mockRejectedValue(failure);
    const getAlbumResult = await loadQueries();

    await expect(getAlbumResult('album-1')).rejects.toBe(failure);
  });
});

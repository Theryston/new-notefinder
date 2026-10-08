import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
// `queries.ts` reads through the server API client, which is server-only.
vi.mock('server-only', () => ({}));

const { serverApi } = await import('@/lib/api/server');
vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));

const mockServerApi = vi.mocked(serverApi);

const loadTracksQuery = async () => {
  const module = await import('./queries');
  return module.getAlbumTracksPage;
};

const page = {
  items: [
    {
      id: 'track-1',
      title: 'Bohemian Rhapsody',
      lengthMs: 354_000,
      disambiguation: '',
      video: false,
      isrcs: ['GBUM71029604'],
      artists: [{ id: 'artist-1', name: 'Queen' }],
      genres: ['rock'],
      disc: { position: 1, title: null },
    },
  ],
  nextCursor: null,
};

describe('getAlbumTracksPage', () => {
  beforeEach(() => {
    vi.resetModules();
    mockServerApi.mockReset();
  });

  it('fetches the cached first page with the shared page size', async () => {
    mockServerApi.mockResolvedValue(page);
    const getAlbumTracksPage = await loadTracksQuery();

    await expect(getAlbumTracksPage('album-1')).resolves.toEqual(page);
    expect(mockServerApi).toHaveBeenCalledWith('/albums/album-1/tracks', {
      schema: expect.anything(),
      query: { limit: 20 },
    });
  });

  it('tags the page with the album tracks tag the API revalidates', async () => {
    mockServerApi.mockResolvedValue(page);
    const getAlbumTracksPage = await loadTracksQuery();
    // Read the mock after the reset, so it is the instance `queries.ts` used.
    const { cacheTag: tagOf } = await import('next/cache');

    await getAlbumTracksPage('album-1');

    expect(tagOf).toHaveBeenCalledWith('album:album-1:tracks');
  });

  it('encodes the ID in the request path', async () => {
    mockServerApi.mockResolvedValue(page);
    const getAlbumTracksPage = await loadTracksQuery();

    await getAlbumTracksPage('album/with space');

    expect(mockServerApi).toHaveBeenCalledWith(
      '/albums/album%2Fwith%20space/tracks',
      { schema: expect.anything(), query: { limit: 20 } },
    );
  });
});

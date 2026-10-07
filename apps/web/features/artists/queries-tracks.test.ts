import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock('server-only', () => ({}));

const { serverApi } = await import('@/lib/api/server');
vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));

const mockServerApi = vi.mocked(serverApi);

const loadTracksQuery = async () => {
  const module = await import('./queries');
  return module.getArtistTracksPage;
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
    },
  ],
  nextCursor: null,
};

describe('getArtistTracksPage', () => {
  beforeEach(() => {
    vi.resetModules();
    mockServerApi.mockReset();
  });

  it('fetches the cached first page with a default limit', async () => {
    mockServerApi.mockResolvedValue(page);
    const getArtistTracksPage = await loadTracksQuery();

    await expect(getArtistTracksPage('artist-1')).resolves.toEqual(page);
    expect(mockServerApi).toHaveBeenCalledWith('/artists/artist-1/tracks', {
      schema: expect.anything(),
      query: { cursor: undefined, limit: 20 },
    });
  });

  it('forwards the cursor and limit', async () => {
    mockServerApi.mockResolvedValue(page);
    const getArtistTracksPage = await loadTracksQuery();

    await getArtistTracksPage('artist-1', { cursor: 'cursor-1', limit: 2 });

    expect(mockServerApi).toHaveBeenCalledWith('/artists/artist-1/tracks', {
      schema: expect.anything(),
      query: { cursor: 'cursor-1', limit: 2 },
    });
  });

  it('rethows fetch failures for the table error UI', async () => {
    const failure = new Error('Broken');
    mockServerApi.mockRejectedValue(failure);
    const getArtistTracksPage = await loadTracksQuery();

    await expect(getArtistTracksPage('artist-1')).rejects.toBe(failure);
  });
});

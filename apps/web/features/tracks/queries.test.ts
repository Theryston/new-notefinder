import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTrackCollection } from './queries';

// `server-only` throws outside the react-server condition, which Vitest
// doesn't use.
vi.mock('server-only', () => ({}));

const nextCache = vi.hoisted(() => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock('next/cache', () => nextCache);

const fetchMock = vi.fn<typeof fetch>();

const track = (id: string) => ({
  id,
  title: `Song ${id}`,
  durationSeconds: 200,
  artists: [{ id: 'a1', name: 'Ana' }],
  album: null,
  thumbnails: [],
  vocalRange: null,
});

const page = { items: [track('t1'), track('t2')], nextCursor: 'next' };

const notFound = () =>
  Response.json(
    { statusCode: 404, code: 'NOT_FOUND', message: 'Artist not found' },
    { status: 404 },
  );

const requestedUrls = () =>
  fetchMock.mock.calls.map(([input]) => String(input)).sort();

beforeEach(() => {
  vi.stubEnv('API_URL', 'http://api.test');
  vi.stubEnv('REVALIDATE_SECRET', 'test-revalidate-secret-at-least-32-chars');
  vi.stubGlobal('fetch', fetchMock);
});

describe('getTrackCollection', () => {
  it('fetches an artist and its first page, tagged for invalidation', async () => {
    const artist = { id: 'a1', name: 'Ana', trackCount: 30 };
    fetchMock.mockImplementation(async (input) =>
      Response.json(String(input).includes('/tracks') ? page : artist),
    );

    await expect(
      getTrackCollection({ kind: 'artist', id: 'a1' }),
    ).resolves.toEqual({ owner: artist, firstPage: page });
    expect(requestedUrls()).toEqual([
      'http://api.test/v1/artists/a1',
      'http://api.test/v1/artists/a1/tracks?limit=24',
    ]);
    expect(nextCache.cacheTag.mock.calls.flat()).toEqual([
      'artist:a1',
      'tracks',
      'track:t1',
      'track:t2',
    ]);
    expect(nextCache.cacheLife).toHaveBeenCalledWith('max');
  });

  it('fetches an album under its own path and tag', async () => {
    const album = { id: 'al1', name: 'Acústico', trackCount: 2 };
    fetchMock.mockImplementation(async (input) =>
      Response.json(String(input).includes('/tracks') ? page : album),
    );

    const data = await getTrackCollection({ kind: 'album', id: 'al1' });

    expect(data?.owner).toEqual(album);
    expect(requestedUrls()).toEqual([
      'http://api.test/v1/albums/al1',
      'http://api.test/v1/albums/al1/tracks?limit=24',
    ]);
    expect(nextCache.cacheTag).toHaveBeenCalledWith('album:al1', 'tracks');
  });

  it('returns null, cached briefly, for an unknown ID', async () => {
    fetchMock.mockImplementation(async () => notFound());

    await expect(
      getTrackCollection({ kind: 'artist', id: 'nope' }),
    ).resolves.toBeNull();
    expect(nextCache.cacheLife).toHaveBeenCalledWith('minutes');
    expect(nextCache.cacheLife).not.toHaveBeenCalledWith('max');
  });

  it('throws any other API failure, so it is not cached', async () => {
    fetchMock.mockImplementation(async () =>
      Response.json(
        { statusCode: 500, code: 'INTERNAL_ERROR', message: 'boom' },
        { status: 500 },
      ),
    );

    await expect(
      getTrackCollection({ kind: 'album', id: 'al1' }),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(nextCache.cacheLife).not.toHaveBeenCalled();
  });
});

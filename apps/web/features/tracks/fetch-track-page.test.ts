import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchTrackPage } from './fetch-track-page';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test');
  vi.stubGlobal('fetch', fetchMock);
});

describe('fetchTrackPage', () => {
  it('asks for the page after the cursor, with the session cookie', async () => {
    const page = { items: [], nextCursor: null };
    fetchMock.mockResolvedValue(Response.json(page));
    const controller = new AbortController();

    await expect(
      fetchTrackPage({ kind: 'album', id: 'al1' }, 'abc', controller.signal),
    ).resolves.toEqual(page);

    const [input, init] = fetchMock.mock.lastCall ?? [];
    expect(String(input)).toBe(
      'http://api.test/v1/albums/al1/tracks?cursor=abc&limit=24',
    );
    expect(init).toMatchObject({
      credentials: 'include',
      signal: controller.signal,
    });
  });

  it('rejects a body that is not a page of tracks', async () => {
    fetchMock.mockResolvedValue(Response.json({ items: 'nope' }));

    await expect(
      fetchTrackPage({ kind: 'artist', id: 'a1' }, 'abc'),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

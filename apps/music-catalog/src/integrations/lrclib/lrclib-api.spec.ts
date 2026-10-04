import { fetchLrclibTrack, LRCLIB_API_USER_AGENT } from './lrclib-api.js';

const query = {
  apiBaseUrl: 'https://lrclib.net',
  title: 'Yellow',
  artist: 'Coldplay',
  album: 'Parachutes',
  durationSeconds: 266,
};

const trackJson = {
  id: 1,
  trackName: 'Yellow',
  artistName: 'Coldplay',
  albumName: 'Parachutes',
  duration: 266.2,
  instrumental: false,
  plainLyrics: 'Look at the stars',
  syncedLyrics: '[00:01.00] Look at the stars',
};

const responseWith = (status: number, body: unknown): Response =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('fetchLrclibTrack', () => {
  it('asks /api/get with the Recording metadata and a User-Agent', async () => {
    const seen: { url: string; userAgent: string | null }[] = [];
    const fetchFn = async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      seen.push({ url, userAgent: headers.get('User-Agent') });
      return responseWith(200, trackJson);
    };

    const track = await fetchLrclibTrack(query, {
      fetchFn: fetchFn as typeof fetch,
    });

    expect(track).toMatchObject({
      trackName: 'Yellow',
      plainLyrics: 'Look at the stars',
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toContain('/api/get?');
    expect(seen[0]?.url).toContain(
      `track_name=${encodeURIComponent('Yellow')}`,
    );
    expect(seen[0]?.url).toContain(
      `artist_name=${encodeURIComponent('Coldplay')}`,
    );
    expect(seen[0]?.userAgent).toBe(LRCLIB_API_USER_AGENT);
  });

  it('answers undefined when the API knows no Lyrics for the query', async () => {
    const fetchFn = (async () =>
      responseWith(404, { statusCode: 404 })) as unknown as typeof fetch;

    await expect(fetchLrclibTrack(query, { fetchFn })).resolves.toBeUndefined();
  });

  it('throws when the API fails, so the caller waits for the next refresh', async () => {
    const fetchFn = (async () =>
      responseWith(500, {
        message: 'Upstream is overloaded',
      })) as unknown as typeof fetch;

    await expect(fetchLrclibTrack(query, { fetchFn })).rejects.toThrow(
      'HTTP 500',
    );
  });

  it('treats a track without Lyrics text as a track without Lyrics kept', async () => {
    const fetchFn = (async () =>
      responseWith(200, {
        ...trackJson,
        plainLyrics: null,
        syncedLyrics: null,
      })) as unknown as typeof fetch;

    await expect(fetchLrclibTrack(query, { fetchFn })).resolves.toMatchObject({
      plainLyrics: null,
      syncedLyrics: null,
    });
  });
});

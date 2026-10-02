import { z } from 'zod';

// LRCLIB asks API clients to identify themselves, so an abusive key can be
// blocked without blocking everyone else.
export const LRCLIB_API_USER_AGENT =
  'notefinder-music-catalog (+https://github.com/Theryston/new-notefinder)';

// The track the public `/api/get` endpoint answers with: the dump's column
// names in camelCase, plus the Lyrics text itself.
const apiTrackSchema = z.object({
  trackName: z.string(),
  artistName: z.string(),
  albumName: z.string(),
  duration: z.number(),
  plainLyrics: z.string().nullable().default(null),
  syncedLyrics: z.string().nullable().default(null),
});

export type LrclibApiTrack = z.output<typeof apiTrackSchema>;

export type LrclibApiQuery = {
  /** The directory the public API lives under (`LRCLIB_API_BASE_URL`). */
  apiBaseUrl: string;
  title: string;
  artist: string;
  album: string;
  /** In seconds, as the endpoint takes it. */
  durationSeconds: number;
};

type FetchFn = typeof fetch;

/**
 * One track from LRCLIB's public API, or undefined when it knows no Lyrics
 * for the query (HTTP 404). Any other failure throws, so the caller decides
 * whether to retry later: a Recording without Lyrics waits for the next dump
 * refresh either way.
 */
export const fetchLrclibTrack = async (
  query: LrclibApiQuery,
  options: { fetchFn?: FetchFn; signal?: AbortSignal } = {},
): Promise<LrclibApiTrack | undefined> => {
  const { fetchFn = fetch, signal } = options;
  const url =
    `${query.apiBaseUrl.replace(/\/+$/, '')}/api/get?` +
    new URLSearchParams({
      artist_name: query.artist,
      track_name: query.title,
      album_name: query.album,
      duration: String(query.durationSeconds),
    }).toString();
  const response = await fetchFn(url, {
    signal,
    headers: { 'User-Agent': LRCLIB_API_USER_AGENT },
  });
  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error(
      `Reading the LRCLIB track for "${query.title}" failed with HTTP ${response.status}`,
    );
  }
  return apiTrackSchema.parse(await response.json());
};

import type { Logger } from '../../logger.js';
import type { FakeDumpRecording } from './fake-lrclib-dump.js';
import { fetchLrclibTrack } from './lrclib-api.js';
import { type DumpTrack, writeLrclibDump } from './write-lrclib-dump.js';

export type ApiDumpOptions = {
  /** `LRCLIB_API_BASE_URL`. */
  apiBaseUrl: string;
  logger: Logger;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
  /** At least this long between two API requests. */
  minGapMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

// The public API is a free service run by one person: ask politely.
const MIN_GAP_MS = 1000;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Writes a dump in the real LRCLIB schema holding the real Lyrics LRCLIB's
 * public API knows for the given Recordings (development `tiny` catalog:
 * nothing is committed, the text comes from LRCLIB on each fresh import).
 * Each Recording is asked with its title, credit, length and its albums in
 * turn, and the dump row carries what LRCLIB answered, so the import's strict
 * match decides on real metadata, exactly as with a downloaded dump. A
 * Recording LRCLIB has no Lyrics for, or a request that fails, only leaves
 * it without a row.
 */
export const writeApiLrclibDump = async (
  path: string,
  recordings: readonly FakeDumpRecording[],
  options: ApiDumpOptions,
): Promise<{ asked: number; found: number }> => {
  const { logger, signal } = options;
  const sleep = options.sleep ?? defaultSleep;
  const gap = options.minGapMs ?? MIN_GAP_MS;
  const tracks: DumpTrack[] = [];
  let asked = 0;
  for (const recording of recordings) {
    if (signal?.aborted || recording.lengthMs === null) {
      continue;
    }
    for (const album of recording.albums) {
      if (asked > 0) {
        await sleep(gap);
      }
      asked++;
      const found = await askApi(recording, album, options);
      if (found !== undefined) {
        tracks.push(found);
        break;
      }
    }
  }
  writeLrclibDump(path, tracks);
  logger.info('Fetched the tiny Lyrics from the LRCLIB API', {
    recordings: recordings.length,
    asked,
    found: tracks.length,
  });
  return { asked, found: tracks.length };
};

const askApi = async (
  recording: FakeDumpRecording,
  album: string,
  options: ApiDumpOptions,
): Promise<DumpTrack | undefined> => {
  try {
    const track = await fetchLrclibTrack(
      {
        apiBaseUrl: options.apiBaseUrl,
        title: recording.title,
        artist: recording.artist,
        album,
        durationSeconds: Math.round((recording.lengthMs ?? 0) / 1000),
      },
      { fetchFn: options.fetchFn, signal: options.signal },
    );
    if (
      track === undefined ||
      (track.plainLyrics === null && track.syncedLyrics === null)
    ) {
      return undefined;
    }
    return {
      title: track.trackName,
      artist: track.artistName,
      album: track.albumName,
      duration: track.duration,
      plain: track.plainLyrics,
      synced: track.syncedLyrics,
      source: 'lrclib-api',
    };
  } catch (error) {
    options.logger.warn('The LRCLIB API failed for a tiny Recording', {
      mbid: recording.mbid,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
};

import type { CatalogDataset } from '@notefinder/contracts';
import {
  fetchLrclibTrack,
  type LrclibApiTrack,
} from '../../integrations/lrclib/lrclib-api.js';
import type { LrclibTrack } from '../../integrations/lrclib/lrclib-dump.js';
import type { MeilisearchIndex } from '../../integrations/meilisearch/meilisearch-index.js';
import {
  type LyricsDocument,
  lyricsSearchText,
} from '../../lib/lyrics-index.js';
import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { SyncService } from '../sync/sync.service.js';
import type {
  LyricsInsert,
  LyricsRepository,
  MatchingRecording,
} from './lyrics.repository.js';
import { matchLrclibTrack } from './match-lyrics.js';

export type LyricsLookupDeps = {
  bootstrap: BootstrapService;
  /** The outbox is only peeked: the drain still owns every entry. */
  sync: Pick<SyncService, 'peekPending'>;
  recordings: LyricsRepository;
  /** Opened with the key that can write: only the worker looks up. */
  lyricsIndex: MeilisearchIndex<LyricsDocument>;
  dataset: CatalogDataset;
  /** The public LRCLIB API new and changed Recordings ask for Lyrics. */
  apiBaseUrl: string;
  logger: Logger;
  fetchFn?: typeof fetch;
  /** At most this many Recordings ask the API per tick; the rest wait. */
  maxPerTick?: number;
  /** At least this long between two API requests. */
  minGapMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

export type LyricsLookupResult = {
  /** Recordings whose Lyrics the API answered with. */
  lookedUp: number;
};

// Small enough that one tick never spends long on the API: the drain right
// after it still owns every entry, and the rest waits for the next tick.
const MAX_PER_TICK = 10;
// The public API is a free service run by one person: ask politely.
const MIN_GAP_MS = 1000;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Gives Recordings the outbox reports their Lyrics from LRCLIB's public API,
 * between dump refreshes: a new Recording would otherwise wait weeks for the
 * next dump. Only Recordings without kept Lyrics are asked, with the same
 * strict match as the dump import (normalized, ±2 s, album tie-break),
 * through a rate-limited queue carrying our User-Agent. An API failure only
 * logs: the Recording stays without Lyrics until the next dump refresh, and
 * the outbox drain behind it never waits on the API's errors.
 */
export class LyricsLookupService {
  constructor(private readonly deps: LyricsLookupDeps) {}

  async fillFromApi(signal?: AbortSignal): Promise<LyricsLookupResult> {
    const candidates = await this.findCandidates(signal);
    let lookedUp = 0;
    const gap = this.deps.minGapMs ?? MIN_GAP_MS;
    const sleep = this.deps.sleep ?? defaultSleep;
    for (const [index, recording] of candidates.entries()) {
      if (signal?.aborted ?? false) {
        break;
      }
      if (index > 0) {
        await sleep(gap);
      }
      const keptLyrics = await this.lookupOne(recording, signal);
      if (keptLyrics !== undefined) {
        lookedUp += 1;
      }
    }
    return { lookedUp };
  }

  // The outbox Recordings still without kept Lyrics, oldest first: new and
  // changed Recordings whose Lyrics the API may know. Empty before the
  // catalog is ready, in `tiny` (which never touches the network), and when
  // the outbox is drained.
  private async findCandidates(
    signal?: AbortSignal,
  ): Promise<MatchingRecording[]> {
    const { phase } = await this.deps.bootstrap.getStatus();
    if (phase !== 'ready' || this.deps.dataset !== 'full') {
      return [];
    }
    const maxPerTick = this.deps.maxPerTick ?? MAX_PER_TICK;
    const entries = await this.deps.sync.peekPending(maxPerTick);
    if (entries.length === 0 || (signal?.aborted ?? false)) {
      return [];
    }
    const ids = [...new Set(entries.map((entry) => entry.recordingId))];
    const recordings = await this.deps.recordings.findMatchingByIds(ids);
    const kept = await this.deps.recordings.findKeptByMbids(
      recordings.map((recording) => recording.mbid),
    );
    return recordings
      .filter((recording) => !hasLyrics(kept.get(recording.mbid)))
      .filter((recording) => recording.lengthMs !== null)
      .slice(0, maxPerTick);
  }

  // One Recording's Lyrics from the API, kept and indexed when the strict
  // match agrees. Undefined when there is nothing to keep; an API failure
  // only logs, so the Recording waits for the next dump refresh instead of
  // holding the tick back.
  private async lookupOne(
    recording: MatchingRecording,
    signal?: AbortSignal,
  ): Promise<LyricsInsert | undefined> {
    let track: LrclibApiTrack | undefined;
    try {
      track = await fetchLrclibTrack(
        {
          apiBaseUrl: this.deps.apiBaseUrl,
          title: recording.title,
          artist: recording.artistCredit,
          album: recording.albumTitles[0] ?? '',
          durationSeconds: (recording.lengthMs ?? 0) / 1000,
        },
        { fetchFn: this.deps.fetchFn, signal },
      );
    } catch (error) {
      this.deps.logger.error(
        'LRCLIB API lookup failed, waiting for the next refresh',
        { mbid: recording.mbid, error },
      );
      return undefined;
    }
    if (track === undefined) {
      return undefined;
    }
    const matched = matchLrclibTrack(
      {
        mbid: recording.mbid,
        title: recording.title,
        lengthMs: recording.lengthMs,
        artistNames: [recording.artistCredit, ...recording.artistNames],
        albumTitles: recording.albumTitles,
      },
      [toDumpTrack(track)],
    );
    if (
      matched === undefined ||
      !hasText(track.plainLyrics, track.syncedLyrics)
    ) {
      return undefined;
    }
    const keptLyrics: LyricsInsert = {
      mbid: recording.mbid,
      plainLyrics: track.plainLyrics,
      syncedLyrics: track.syncedLyrics,
    };
    await this.deps.recordings.saveLyrics([keptLyrics]);
    const lyrics = lyricsSearchText(track.plainLyrics, track.syncedLyrics);
    if (lyrics !== undefined) {
      await this.deps.lyricsIndex.upsert([{ mbid: recording.mbid, lyrics }]);
    }
    this.deps.logger.info('LRCLIB API lookup kept Lyrics', {
      mbid: recording.mbid,
    });
    return keptLyrics;
  }
}

const toDumpTrack = (track: LrclibApiTrack): LrclibTrack => ({
  id: 0,
  title: track.trackName,
  artist: track.artistName,
  album: track.albumName,
  duration: track.duration,
});

const hasText = (plain: string | null, synced: string | null): boolean =>
  (plain?.trim() ?? '') !== '' || (synced?.trim() ?? '') !== '';

const hasLyrics = (
  kept: { plain: string | null; synced: string | null } | undefined,
): boolean => kept !== undefined && hasText(kept.plain, kept.synced);

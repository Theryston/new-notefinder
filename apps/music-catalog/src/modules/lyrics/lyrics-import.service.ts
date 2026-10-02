import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CatalogDataset } from '@notefinder/contracts';
import {
  type FakeDumpRecording,
  writeFakeLrclibDump,
} from '../../integrations/lrclib/fake-lrclib-dump.js';
import {
  downloadLrclibDump,
  fetchLatestDumpKey,
} from '../../integrations/lrclib/lrclib-download.js';
import {
  type LrclibDump,
  type LrclibTrack,
  openLrclibDump,
} from '../../integrations/lrclib/lrclib-dump.js';
import { normalizeLyricsText } from '../../lib/normalize-text.js';
import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type {
  LyricsRepository,
  MatchingRecording,
} from './lyrics.repository.js';
import { matchLrclibTrack } from './match-lyrics.js';

export type LyricsImportDeps = {
  bootstrap: BootstrapService;
  recordings: LyricsRepository;
  dataset: CatalogDataset;
  /** The directory the dump files live under; the key is appended to it. */
  lrclibBaseUrl: string;
  /** The listing endpoint the latest dump key is read from. */
  lrclibListingUrl: string;
  logger: Logger;
  /** Where the dump file lands while it is imported. */
  tmpDir?: string;
  /** Recordings matched per batch. */
  matchBatchSize?: number;
};

export type LyricsImportResult = {
  /** Recordings with a confident match. */
  matched: number;
  /** Recordings whose Lyrics were kept. */
  saved: number;
};

type MatchedPair = { mbid: string; trackId: number };

// How many Recordings the fake dump is generated from: all of `tiny`'s few
// hundred, so the dev flow stays local.
const FAKE_DUMP_RECORDINGS = 3000;
const MATCH_BATCH_SIZE = 1000;
// The dump lookup window around a Recording's length, wider than the ±2 s
// rule: the exact boundary is applied in code, on milliseconds.
const DURATION_WINDOW_S = 2.5;

/**
 * Imports the LRCLIB dump into our schema, once per bootstrap: `tiny`
 * generates a fake dump locally from its seeded Recordings (nothing is
 * downloaded), `full` downloads and gunzips the real one as a stream. Two
 * passes: Recordings are matched against the dump's lightweight track
 * metadata first, then only the Lyrics of matched tracks are copied. The
 * temp file is deleted afterwards, so unmatched Lyrics never reach our
 * schema. Runs while the catalog is `restored` or `indexing`; afterwards
 * (and before) it skips: refreshing an older import from a newer dump is
 * the refresh ticket's job.
 */
export class LyricsImportService {
  constructor(private readonly deps: LyricsImportDeps) {}

  async importOnce(signal?: AbortSignal): Promise<LyricsImportResult> {
    const { phase } = await this.deps.bootstrap.getStatus();
    if (phase !== 'restored' && phase !== 'indexing') {
      this.deps.logger.info('Skipping the LRCLIB import', { phase });
      return { matched: 0, saved: 0 };
    }
    const startedAt = Date.now();
    const path = await this.acquireDump(signal);
    try {
      const dump = openLrclibDump(path);
      try {
        const result = await this.importFromDump(dump, signal);
        this.deps.logger.info('LRCLIB import finished', {
          ...result,
          durationMs: Date.now() - startedAt,
        });
        return result;
      } finally {
        dump.close();
      }
    } finally {
      await rm(path, { force: true });
    }
  }

  private async acquireDump(signal?: AbortSignal): Promise<string> {
    const dir = this.deps.tmpDir ?? tmpdir();
    if (this.deps.dataset === 'tiny') {
      return this.generateFakeDump(dir, signal);
    }
    const key = await fetchLatestDumpKey(this.deps.lrclibListingUrl);
    this.deps.logger.info('Downloading the LRCLIB dump', { key });
    const downloaded = await downloadLrclibDump({
      baseUrl: this.deps.lrclibBaseUrl,
      key,
      dir,
      signal,
    });
    return downloaded.path;
  }

  private async generateFakeDump(
    dir: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const recordings: FakeDumpRecording[] = [];
    let afterId = 0;
    while (
      recordings.length < FAKE_DUMP_RECORDINGS &&
      !(signal?.aborted ?? false)
    ) {
      const batch = await this.deps.recordings.findMatchBatch(
        afterId,
        MATCH_BATCH_SIZE,
      );
      const last = batch[batch.length - 1];
      if (last === undefined) {
        break;
      }
      afterId = last.id;
      for (const row of batch) {
        recordings.push({
          mbid: row.mbid,
          title: row.title,
          artist: row.artistCredit,
          lengthMs: row.lengthMs,
          albums: row.albumTitles,
        });
      }
    }
    const path = join(dir, `lrclib-fake-${Date.now()}.sqlite3`);
    writeFakeLrclibDump(path, recordings.slice(0, FAKE_DUMP_RECORDINGS));
    this.deps.logger.info('Generated the fake LRCLIB dump', {
      path,
      recordings: recordings.length,
    });
    return path;
  }

  private async importFromDump(
    dump: LrclibDump,
    signal?: AbortSignal,
  ): Promise<LyricsImportResult> {
    let afterId = 0;
    let matched = 0;
    let saved = 0;
    const batchSize = this.deps.matchBatchSize ?? MATCH_BATCH_SIZE;
    for (;;) {
      if (signal?.aborted ?? false) {
        this.deps.logger.info('LRCLIB import paused: stopping', {
          matched,
          saved,
        });
        break;
      }
      const batch = await this.deps.recordings.findMatchBatch(
        afterId,
        batchSize,
      );
      const last = batch[batch.length - 1];
      if (last === undefined) {
        break;
      }
      afterId = last.id;
      const pairs = this.matchBatch(dump, batch);
      matched += pairs.length;
      saved += await this.copyBatch(dump, pairs);
    }
    return { matched, saved };
  }

  private matchBatch(
    dump: LrclibDump,
    batch: readonly MatchingRecording[],
  ): MatchedPair[] {
    const pairs: MatchedPair[] = [];
    for (const recording of batch) {
      const track = this.matchRecording(dump, recording);
      if (track !== undefined) {
        pairs.push({ mbid: recording.mbid, trackId: track.id });
      }
    }
    return pairs;
  }

  private matchRecording(
    dump: LrclibDump,
    recording: MatchingRecording,
  ): LrclibTrack | undefined {
    if (recording.lengthMs === null) {
      return undefined;
    }
    const seconds = recording.lengthMs / 1000;
    const artists = [recording.artistCredit, ...recording.artistNames];
    const seen = new Set<number>();
    const candidates: LrclibTrack[] = [];
    for (const artist of new Set(artists)) {
      const found = dump.findCandidates({
        titleLower: recording.title.toLowerCase(),
        titleNormalized: normalizeLyricsText(recording.title),
        artistLower: artist.toLowerCase(),
        artistNormalized: normalizeLyricsText(artist),
        minDuration: seconds - DURATION_WINDOW_S,
        maxDuration: seconds + DURATION_WINDOW_S,
      });
      for (const track of found) {
        if (!seen.has(track.id)) {
          seen.add(track.id);
          candidates.push(track);
        }
      }
    }
    return matchLrclibTrack(
      {
        mbid: recording.mbid,
        title: recording.title,
        lengthMs: recording.lengthMs,
        artistNames: artists,
        albumTitles: recording.albumTitles,
      },
      candidates,
    );
  }

  private async copyBatch(
    dump: LrclibDump,
    pairs: readonly MatchedPair[],
  ): Promise<number> {
    if (pairs.length === 0) {
      return 0;
    }
    const byTrack = new Map(pairs.map((pair) => [pair.trackId, pair.mbid]));
    const rows = dump
      .readLyrics([...byTrack.keys()])
      .filter(
        (lyrics) =>
          (lyrics.plain?.trim() ?? '') !== '' ||
          (lyrics.synced?.trim() ?? '') !== '',
      )
      .map((lyrics) => ({
        mbid: byTrack.get(lyrics.trackId) ?? '',
        plainLyrics: lyrics.plain,
        syncedLyrics: lyrics.synced,
      }))
      .filter((row) => row.mbid !== '');
    await this.deps.recordings.saveLyrics(rows);
    return rows.length;
  }
}

import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CatalogDataset } from '@notefinder/contracts';
import { writeApiLrclibDump } from '../../integrations/lrclib/api-lrclib-dump.js';
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
  openLrclibDump,
} from '../../integrations/lrclib/lrclib-dump.js';
import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { LyricsRepository } from './lyrics.repository.js';
import type { LyricsRefreshRepository } from './lyrics-refresh.repository.js';
import {
  type MatchedPair,
  readMatchedLyrics,
  walkMatchedBatches,
} from './match-batch.js';

export type LyricsImportDeps = {
  bootstrap: BootstrapService;
  recordings: LyricsRepository;
  dataset: CatalogDataset;
  /** The directory the dump files live under; the key is appended to it. */
  lrclibBaseUrl: string;
  /** The listing endpoint the latest dump key is read from. */
  lrclibListingUrl: string;
  logger: Logger;
  /**
   * Where `tiny` gets its Lyrics: `fake` (the default) generates placeholder
   * text locally; `api` asks LRCLIB's public API for the real Lyrics of the
   * seeded Recordings, at `apiBaseUrl` (`LRCLIB_API_BASE_URL`).
   */
  tinySource?: 'fake' | 'api';
  apiBaseUrl?: string;
  fetchFn?: typeof fetch;
  /** Where the dump file lands while it is imported. */
  tmpDir?: string;
  /** Recordings matched per batch. */
  matchBatchSize?: number;
  /**
   * Remembers the imported dump key, so the refresh skips it instead of
   * downloading the same file again. Absent in unit contexts; the
   * composition root always passes it.
   */
  refreshState?: LyricsRefreshRepository;
};

export type LyricsImportResult = {
  /** Recordings with a confident match. */
  matched: number;
  /** Recordings whose Lyrics were kept. */
  saved: number;
};

// How many Recordings the fake dump is generated from: all of `tiny`'s few
// hundred, so the dev flow stays local.
const FAKE_DUMP_RECORDINGS = 3000;
const MATCH_BATCH_SIZE = 1000;

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
    const acquired = await this.acquireDump(signal);
    try {
      const dump = openLrclibDump(acquired.path);
      try {
        const result = await this.importFromDump(dump, signal);
        if (acquired.key !== undefined) {
          await this.deps.refreshState?.recordImport(new Date(), acquired.key);
        }
        this.deps.logger.info('LRCLIB import finished', {
          ...result,
          durationMs: Date.now() - startedAt,
        });
        return result;
      } finally {
        dump.close();
      }
    } finally {
      await rm(acquired.path, { force: true });
    }
  }

  private async acquireDump(
    signal?: AbortSignal,
  ): Promise<{ path: string; key?: string }> {
    const dir = this.deps.tmpDir ?? tmpdir();
    if (this.deps.dataset === 'tiny') {
      return { path: await this.generateFakeDump(dir, signal) };
    }
    const key = await fetchLatestDumpKey(this.deps.lrclibListingUrl);
    this.deps.logger.info('Downloading the LRCLIB dump', { key });
    const downloaded = await downloadLrclibDump({
      baseUrl: this.deps.lrclibBaseUrl,
      key,
      dir,
      signal,
    });
    return { path: downloaded.path, key };
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
    const seeded = recordings.slice(0, FAKE_DUMP_RECORDINGS);
    if (this.deps.tinySource === 'api' && this.deps.apiBaseUrl !== undefined) {
      await writeApiLrclibDump(path, seeded, {
        apiBaseUrl: this.deps.apiBaseUrl,
        logger: this.deps.logger,
        fetchFn: this.deps.fetchFn,
        signal,
      });
      return path;
    }
    writeFakeLrclibDump(path, seeded);
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
    let matched = 0;
    let saved = 0;
    await walkMatchedBatches(dump, {
      findMatchBatch: (afterId, limit) =>
        this.deps.recordings.findMatchBatch(afterId, limit),
      batchSize: this.deps.matchBatchSize ?? MATCH_BATCH_SIZE,
      signal,
      visit: async (_batch, pairs) => {
        matched += pairs.length;
        saved += await this.copyBatch(dump, pairs);
      },
      paused: () => {
        this.deps.logger.info('LRCLIB import paused: stopping', {
          matched,
          saved,
        });
      },
    });
    return { matched, saved };
  }

  private async copyBatch(
    dump: LrclibDump,
    pairs: readonly MatchedPair[],
  ): Promise<number> {
    const rows = readMatchedLyrics(dump, pairs);
    if (rows.length === 0) {
      return 0;
    }
    await this.deps.recordings.saveLyrics(rows);
    return rows.length;
  }
}

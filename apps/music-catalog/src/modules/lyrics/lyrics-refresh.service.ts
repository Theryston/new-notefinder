import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { CatalogDataset } from '@notefinder/contracts';
import {
  downloadLrclibDump,
  fetchLatestDumpKey,
} from '../../integrations/lrclib/lrclib-download.js';
import {
  type LrclibDump,
  openLrclibDump,
} from '../../integrations/lrclib/lrclib-dump.js';
import type { MeilisearchIndex } from '../../integrations/meilisearch/meilisearch-index.js';
import {
  type LyricsDocument,
  lyricsSearchText,
} from '../../lib/lyrics-index.js';
import type { Logger } from '../../logger.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type {
  LyricsInsert,
  LyricsRepository,
  MatchingRecording,
} from './lyrics.repository.js';
import type { LyricsRefreshRepository } from './lyrics-refresh.repository.js';
import {
  type MatchedPair,
  readMatchedLyrics,
  walkMatchedBatches,
} from './match-batch.js';

export type LyricsRefreshDeps = {
  bootstrap: BootstrapService;
  recordings: LyricsRepository;
  refreshState: LyricsRefreshRepository;
  /** Opened with the key that can write: only the worker refreshes. */
  lyricsIndex: MeilisearchIndex<LyricsDocument>;
  dataset: CatalogDataset;
  /** The directory the dump files live under; the key is appended to it. */
  lrclibBaseUrl: string;
  /** The listing endpoint the latest dump key is read from. */
  lrclibListingUrl: string;
  /** How often the listing is polled for a newer dump. */
  checkIntervalMs: number;
  /** At most one dump refresh per this many days. */
  minIntervalDays: number;
  logger: Logger;
  /** Where the dump file lands while it is imported. */
  tmpDir?: string;
  /** Recordings matched per batch. */
  matchBatchSize?: number;
};

export type LyricsRefreshResult = {
  /** Whether a newer dump was imported on this tick. */
  refreshed: boolean;
  /** Recordings whose kept Lyrics changed and were reindexed. */
  changed: number;
  /** Recordings whose Lyrics vanished and were forgotten. */
  removed: number;
};

const MATCH_BATCH_SIZE = 1000;
const MS_PER_DAY = 86_400_000;

/**
 * Keeps the kept Lyrics fresh after the first import: once the catalog is
 * `ready`, each worker tick polls the LRCLIB listing for a newer dump and,
 * at most once per `minIntervalDays`, imports it with the same two-pass
 * strict match as the first import. Only Recordings whose Lyrics changed
 * are written and reindexed; the phase never moves, so `getRecording` and
 * `search` keep answering throughout. A failed check or download only logs:
 * the catalog serves the kept Lyrics until the next tick.
 */
export class LyricsRefreshService {
  constructor(private readonly deps: LyricsRefreshDeps) {}

  async refreshOnce(signal?: AbortSignal): Promise<LyricsRefreshResult> {
    const idle = { refreshed: false, changed: 0, removed: 0 };
    const { phase } = await this.deps.bootstrap.getStatus();
    if (phase !== 'ready') {
      return idle;
    }
    if (this.deps.dataset !== 'full') {
      this.deps.logger.info('Skipping the LRCLIB refresh', {
        dataset: this.deps.dataset,
      });
      return idle;
    }
    const now = new Date();
    const state = await this.deps.refreshState.getState();
    if (!this.isCheckDue(state.lastCheckedAt, now)) {
      return idle;
    }
    // Read before the check below: it records the poll, never the key.
    const previousKey = state.lastDumpKey;
    const key = await this.fetchKey(previousKey, now);
    if (key === undefined || key === previousKey) {
      return idle;
    }
    if (!this.isRefreshDue(state.lastImportedAt, now)) {
      this.deps.logger.info('Skipping the LRCLIB refresh', {
        key,
        reason: 'minimum interval has not passed',
      });
      return idle;
    }
    return this.refreshFromKey(key, now, signal);
  }

  private isCheckDue(lastCheckedAt: Date | null, now: Date): boolean {
    return (
      lastCheckedAt === null ||
      now.getTime() - lastCheckedAt.getTime() >= this.deps.checkIntervalMs
    );
  }

  private isRefreshDue(lastImportedAt: Date | null, now: Date): boolean {
    return (
      lastImportedAt === null ||
      now.getTime() - lastImportedAt.getTime() >=
        this.deps.minIntervalDays * MS_PER_DAY
    );
  }

  // The latest listing key, or undefined when there is nothing to import.
  // A listing failure is recorded as a check (so it is not retried at once)
  // and only logged: the catalog keeps serving the kept Lyrics. The polled
  // key is not stored here: `lastDumpKey` stays the last imported one, so a
  // newer dump seen while the minimum interval has not passed is still
  // imported once the interval passes.
  private async fetchKey(
    importedKey: string | null,
    now: Date,
  ): Promise<string | undefined> {
    try {
      const key = await fetchLatestDumpKey(this.deps.lrclibListingUrl);
      await this.deps.refreshState.recordCheck(now);
      if (key === importedKey) {
        this.deps.logger.info('Skipping the LRCLIB refresh', {
          key,
          reason: 'dump already imported',
        });
        return undefined;
      }
      return key;
    } catch (error) {
      await this.deps.refreshState.recordCheck(now);
      this.deps.logger.error(
        'LRCLIB refresh check failed, serving the kept Lyrics',
        { error },
      );
      return undefined;
    }
  }

  private async refreshFromKey(
    key: string,
    now: Date,
    signal?: AbortSignal,
  ): Promise<LyricsRefreshResult> {
    const startedAt = Date.now();
    const dir = this.deps.tmpDir ?? tmpdir();
    this.deps.logger.info('Refreshing the LRCLIB dump', { key });
    const downloaded = await downloadLrclibDump({
      baseUrl: this.deps.lrclibBaseUrl,
      key,
      dir,
      signal,
    });
    try {
      const dump = openLrclibDump(downloaded.path);
      try {
        const { changed, removed } = await this.importChanged(dump, signal);
        await this.deps.refreshState.recordImport(now, key);
        this.deps.logger.info('LRCLIB refresh finished', {
          key,
          changed,
          removed,
          durationMs: Date.now() - startedAt,
        });
        return { refreshed: true, changed, removed };
      } finally {
        dump.close();
      }
    } finally {
      await rm(downloaded.path, { force: true });
    }
  }

  // Walks every Recording like the first import, but only writes and
  // reindexes the Lyrics that changed: new and updated matches go to the
  // table and the `lyrics` index, matches the new dump lost are forgotten
  // from both. Replacing documents by MBID is idempotent, so a tick that
  // dies mid-refresh redoes only the writes on its return.
  private async importChanged(
    dump: LrclibDump,
    signal?: AbortSignal,
  ): Promise<{ changed: number; removed: number }> {
    let changed = 0;
    let removed = 0;
    await walkMatchedBatches(dump, {
      findMatchBatch: (afterId, limit) =>
        this.deps.recordings.findMatchBatch(afterId, limit),
      batchSize: this.deps.matchBatchSize ?? MATCH_BATCH_SIZE,
      signal,
      visit: async (batch, pairs) => {
        const step = await this.applyBatch(dump, batch, pairs);
        changed += step.changed;
        removed += step.removed;
      },
      paused: () => {
        this.deps.logger.info('LRCLIB refresh paused: stopping', {
          changed,
          removed,
        });
      },
    });
    return { changed, removed };
  }

  private async applyBatch(
    dump: LrclibDump,
    batch: readonly MatchingRecording[],
    pairs: readonly MatchedPair[],
  ): Promise<{ changed: number; removed: number }> {
    const fresh = readMatchedLyrics(dump, pairs);
    const kept = await this.deps.recordings.findKeptByMbids(
      batch.map((recording) => recording.mbid),
    );
    const changed = fresh.filter((row) => !sameLyrics(kept.get(row.mbid), row));
    const freshMbids = new Set(fresh.map((row) => row.mbid));
    const removed = [...kept.keys()].filter(
      (mbid) => !freshMbids.has(mbid) && this.wasMatched(kept.get(mbid)),
    );
    // Only what changed reaches the table and the index: an unchanged
    // refresh leaves both alone.
    if (changed.length > 0) {
      await this.deps.recordings.saveLyrics(changed);
      await this.deps.lyricsIndex.upsert(documentsOf(changed));
    }
    if (removed.length > 0) {
      await this.deps.recordings.deleteLyrics(removed);
      await this.deps.lyricsIndex.deleteDocuments(removed);
    }
    return { changed: changed.length, removed: removed.length };
  }

  // A kept row counts as matched when it holds text: only then did an
  // earlier dump match it, so only then is its absence a removal.
  private wasMatched(
    kept: { plain: string | null; synced: string | null } | undefined,
  ): boolean {
    return (
      kept !== undefined &&
      ((kept.plain?.trim() ?? '') !== '' || (kept.synced?.trim() ?? '') !== '')
    );
  }
}

const sameLyrics = (
  kept: { plain: string | null; synced: string | null } | undefined,
  fresh: LyricsInsert,
): boolean =>
  kept !== undefined &&
  (kept.plain ?? null) === (fresh.plainLyrics ?? null) &&
  (kept.synced ?? null) === (fresh.syncedLyrics ?? null);

const documentsOf = (rows: readonly LyricsInsert[]): LyricsDocument[] => {
  const documents: LyricsDocument[] = [];
  for (const row of rows) {
    const lyrics = lyricsSearchText(row.plainLyrics, row.syncedLyrics);
    if (lyrics !== undefined) {
      documents.push({ mbid: row.mbid, lyrics });
    }
  }
  return documents;
};

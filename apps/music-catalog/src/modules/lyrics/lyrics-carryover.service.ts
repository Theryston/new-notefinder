import type { Logger } from '../../logger.js';
import type {
  KeptLyricsRow,
  LyricsInsert,
  LyricsRepository,
} from './lyrics.repository.js';
import { revalidateCarriedLyrics } from './revalidate-lyrics.js';

export type LyricsCarryoverDeps = {
  /** The serving copy: kept Lyrics with the Recordings they matched. */
  source: LyricsRepository;
  /** The parallel copy: receives the Lyrics that still match. */
  target: LyricsRepository;
  /** Kept Lyrics revalidated per round; defaults to 1000. */
  batchSize?: number;
  logger: Logger;
};

export type LyricsCarryoverResult = {
  /** Recordings whose Lyrics moved to the parallel copy. */
  carried: number;
  /** Recordings whose Lyrics the new copy no longer matches. */
  dropped: number;
};

const CARRYOVER_BATCH_SIZE = 1000;

/**
 * Reuses the kept Lyrics for the parallel copy, with the strict match
 * rerun: every kept row is revalidated against the same MBID on the new
 * copy (same take still, per `revalidateCarriedLyrics`) and only then
 * written there; the rest is dropped. Nothing is downloaded: the dump the
 * import read is long deleted, and the source is our own schema. Aborting
 * `signal` stops it after the batch in progress; the next run starts over
 * from the first MBID (writes replace by MBID, drops are idempotent).
 */
export class LyricsCarryoverService {
  constructor(private readonly deps: LyricsCarryoverDeps) {}

  async carryOver(signal?: AbortSignal): Promise<LyricsCarryoverResult> {
    let afterMbid = '';
    let carried = 0;
    let dropped = 0;
    const batchSize = this.deps.batchSize ?? CARRYOVER_BATCH_SIZE;
    for (;;) {
      if (signal?.aborted ?? false) {
        this.deps.logger.info('Lyrics carry-over paused: stopping', {
          carried,
          dropped,
        });
        break;
      }
      const batch = await this.deps.source.findKeptBatch(afterMbid, batchSize);
      const last = batch[batch.length - 1];
      if (last === undefined) {
        break;
      }
      afterMbid = last.mbid;
      const outcome = await this.carryBatch(batch);
      carried += outcome.carried;
      dropped += outcome.dropped;
    }
    this.deps.logger.info('Lyrics carry-over finished', { carried, dropped });
    return { carried, dropped };
  }

  private async carryBatch(
    batch: readonly KeptLyricsRow[],
  ): Promise<LyricsCarryoverResult> {
    const { source, target } = this.deps;
    const mbids = batch.map((row) => row.mbid);
    const [before, after] = await Promise.all([
      source.findMatchRecordingsByMbids(mbids),
      target.findMatchRecordingsByMbids(mbids),
    ]);
    const beforeByMbid = new Map(before.map((row) => [row.mbid, row]));
    const afterByMbid = new Map(after.map((row) => [row.mbid, row]));
    const keep: LyricsInsert[] = [];
    const drop: string[] = [];
    for (const row of batch) {
      const verdict = revalidateCarriedLyrics({
        kept: row,
        before: beforeByMbid.get(row.mbid),
        after: afterByMbid.get(row.mbid),
      });
      if (verdict === 'keep') {
        keep.push({
          mbid: row.mbid,
          plainLyrics: row.plain,
          syncedLyrics: row.synced,
        });
      } else {
        drop.push(row.mbid);
      }
    }
    await target.saveLyrics(keep);
    await target.deleteKeptByMbids(drop);
    return { carried: keep.length, dropped: drop.length };
  }
}

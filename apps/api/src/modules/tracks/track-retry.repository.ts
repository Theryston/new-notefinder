import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { desc, eq, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { DatabaseAdapter } from '../../database/database.js';
import { trackProcessings } from '../../database/schema/track-processings.js';
import type { ProcessingOutputKey } from './track-processing-outputs.js';
import type { RetryableProcessing, RetryPlan } from './track-retry.js';

/** The namespace of the Track locks that serialize its retries. */
const TRACK_PROCESSING_LOCK_SCOPE = 'tracks.processings';

/**
 * The columns of a Processing's outputs, one per output: a new output must be
 * listed here, or the `satisfies` check fails, so a retry never misses one.
 */
const processingOutputColumns = {
  videoId: trackProcessings.videoId,
  videoSource: trackProcessings.videoSource,
  musicWavUrl: trackProcessings.musicWavUrl,
  musicMp3Url: trackProcessings.musicMp3Url,
  vocalsWavUrl: trackProcessings.vocalsWavUrl,
  vocalsMp3Url: trackProcessings.vocalsMp3Url,
  runpodJobId: trackProcessings.runpodJobId,
} satisfies Record<ProcessingOutputKey, AnyPgColumn>;

/**
 * The reads and writes of a retry: the latest Processing a retry reads, the new
 * Processing it starts and the Track lock that serializes retries. The
 * Contributor rows of a retry are `TrackProcessingRepository`'s.
 */
@Injectable()
export class TrackRetryRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /**
   * A new Processing of a Track that starts at the step a retry resumes from,
   * with the outputs the failed run kept; returns its ID. It is queued: the
   * caller starts its first step after the transaction.
   */
  async insertRetryProcessing(
    trackId: string,
    plan: RetryPlan,
  ): Promise<string> {
    const [row] = await this.txHost.tx
      .insert(trackProcessings)
      .values({ trackId, resumeFrom: plan.resumeFrom, ...plan.outputs })
      .returning({ id: trackProcessings.id });
    if (row === undefined) {
      throw new Error('Insert returned no row');
    }
    return row.id;
  }

  /** The latest Processing of a Track as a retry reads it; undefined when it has none. */
  async findLatestForRetry(
    trackId: string,
  ): Promise<RetryableProcessing | undefined> {
    const [row] = await this.txHost.tx
      .select({
        status: trackProcessings.status,
        failureCode: trackProcessings.failureCode,
        resumeFrom: trackProcessings.resumeFrom,
        ...processingOutputColumns,
      })
      .from(trackProcessings)
      .where(eq(trackProcessings.trackId, trackId))
      .orderBy(desc(trackProcessings.createdAt), desc(trackProcessings.id))
      .limit(1);
    return row;
  }

  /**
   * Serializes the retries of a Track until the transaction ends, so two of
   * them can't both start a Processing from the same failed one. A
   * transaction-scoped advisory lock keyed by the Track's ID.
   */
  async lockTrackProcessings(trackId: string): Promise<void> {
    await this.txHost.tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${TRACK_PROCESSING_LOCK_SCOPE}), hashtext(${trackId}))`,
    );
  }
}

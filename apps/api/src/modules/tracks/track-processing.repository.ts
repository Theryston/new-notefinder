import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type {
  TrackProcessingFailureCode,
  TrackProcessingStatus,
  TrackProcessingStep,
  TrackProcessingVideoSource,
} from '@notefinder/contracts';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import {
  trackContributionKind,
  trackContributions,
  trackContributors,
} from '../../database/schema/track-contributors.js';
import { trackProcessings } from '../../database/schema/track-processings.js';
import type { TrackProcessingRow } from './track-processing-view.js';

/** A Contribution's kind, as the schema stores it. */
export type TrackContributionKind =
  (typeof trackContributionKind.enumValues)[number];

/** A Processing as one of its step jobs reads it. */
export type ProcessingForStep = {
  id: string;
  trackId: string;
  status: TrackProcessingStatus;
  /** The video a run already chose; a retry keeps it. */
  videoId: string | null;
  videoSource: TrackProcessingVideoSource | null;
};

/** The Processing with this ID, while its status is one of `statuses`. */
const processingInStatus = (
  processingId: string,
  statuses: readonly TrackProcessingStatus[],
) =>
  and(
    eq(trackProcessings.id, processingId),
    inArray(trackProcessings.status, [...statuses]),
  );

/**
 * Processings, Contributors and Contributions of Tracks. The Track itself is
 * in `TracksRepository`; this one owns what the Processing page and the
 * requests write.
 */
@Injectable()
export class TrackProcessingRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /** A new Processing of a Track, queued; returns its ID. */
  async insertQueuedProcessing(trackId: string): Promise<string> {
    const [row] = await this.txHost.tx
      .insert(trackProcessings)
      .values({ trackId })
      .returning({ id: trackProcessings.id });
    if (row === undefined) {
      throw new Error('Insert returned no row');
    }
    return row.id;
  }

  /** The newest Processing of a Track, which is the Track's current state. */
  async findLatestProcessing(
    trackId: string,
  ): Promise<TrackProcessingRow | undefined> {
    const [row] = await this.txHost.tx
      .select({
        id: trackProcessings.id,
        status: trackProcessings.status,
        failureCode: trackProcessings.failureCode,
        resumeFrom: trackProcessings.resumeFrom,
        videoId: trackProcessings.videoId,
        videoSource: trackProcessings.videoSource,
        createdAt: trackProcessings.createdAt,
        startedAt: trackProcessings.startedAt,
        finishedAt: trackProcessings.finishedAt,
      })
      .from(trackProcessings)
      .where(eq(trackProcessings.trackId, trackId))
      .orderBy(desc(trackProcessings.createdAt), desc(trackProcessings.id))
      .limit(1);
    return row;
  }

  /**
   * The Contributor of a User on a Track, created by their first Contribution
   * to it; returns its ID. Concurrent first Contributions end in one row.
   */
  async findOrInsertContributor(
    trackId: string,
    userId: string,
  ): Promise<string> {
    const [inserted] = await this.txHost.tx
      .insert(trackContributors)
      .values({ trackId, userId })
      .onConflictDoNothing({
        target: [trackContributors.trackId, trackContributors.userId],
      })
      .returning({ id: trackContributors.id });
    if (inserted !== undefined) {
      return inserted.id;
    }
    const [existing] = await this.txHost.tx
      .select({ id: trackContributors.id })
      .from(trackContributors)
      .where(
        and(
          eq(trackContributors.trackId, trackId),
          eq(trackContributors.userId, userId),
        ),
      )
      .limit(1);
    if (existing === undefined) {
      throw new Error('Contributor vanished after its insert conflicted');
    }
    return existing.id;
  }

  /** Records one Contribution: an action of a Contributor that started a Processing. */
  async insertContribution(row: {
    contributorId: string;
    kind: TrackContributionKind;
    processingId: string;
  }): Promise<void> {
    await this.txHost.tx.insert(trackContributions).values(row);
  }

  /** The Contributors of a Track, in the order they first contributed. */
  findContributors(trackId: string): Promise<{ id: string; userId: string }[]> {
    return this.txHost.tx
      .select({ id: trackContributors.id, userId: trackContributors.userId })
      .from(trackContributors)
      .where(eq(trackContributors.trackId, trackId))
      .orderBy(asc(trackContributors.createdAt), asc(trackContributors.id));
  }

  /** A Processing as its step job reads it; undefined for an unknown ID. */
  async findProcessing(
    processingId: string,
  ): Promise<ProcessingForStep | undefined> {
    const [row] = await this.txHost.tx
      .select({
        id: trackProcessings.id,
        trackId: trackProcessings.trackId,
        status: trackProcessings.status,
        videoId: trackProcessings.videoId,
        videoSource: trackProcessings.videoSource,
      })
      .from(trackProcessings)
      .where(eq(trackProcessings.id, processingId))
      .limit(1);
    return row;
  }

  // The writes below are guarded by the status the job expects. A job that
  // runs late (redelivered, or stalled past its lock) finds the Processing
  // moved on, and its write matches no row: the answer is false, and nothing
  // changes. The guards are the database's answer to a race; the reads a job
  // does first only save work.

  /**
   * A step started: the status moves to it, the first start is kept. False
   * when the Processing is no longer in one of the `dueStatuses` (it moved on
   * or ended meanwhile).
   */
  async markStepStarted(
    processingId: string,
    step: TrackProcessingStep,
    dueStatuses: readonly TrackProcessingStatus[],
  ): Promise<boolean> {
    const rows = await this.txHost.tx
      .update(trackProcessings)
      .set({
        status: step,
        startedAt: sql`coalesce(${trackProcessings.startedAt}, now())`,
      })
      .where(processingInStatus(processingId, dueStatuses))
      .returning({ id: trackProcessings.id });
    return rows.length > 0;
  }

  /** The video a step chose, and where it was found, while the step runs. */
  async saveVideo(
    processingId: string,
    step: TrackProcessingStep,
    video: { videoId: string; source: TrackProcessingVideoSource },
  ): Promise<boolean> {
    const rows = await this.txHost.tx
      .update(trackProcessings)
      .set({ videoId: video.videoId, videoSource: video.source })
      .where(processingInStatus(processingId, [step]))
      .returning({ id: trackProcessings.id });
    return rows.length > 0;
  }

  /** The last step is done: the Processing completes. False if it moved on. */
  async markCompleted(
    processingId: string,
    lastStep: TrackProcessingStep,
  ): Promise<boolean> {
    const rows = await this.txHost.tx
      .update(trackProcessings)
      .set({
        status: 'COMPLETED',
        failureCode: null,
        resumeFrom: null,
        finishedAt: new Date(),
      })
      .where(processingInStatus(processingId, [lastStep]))
      .returning({ id: trackProcessings.id });
    return rows.length > 0;
  }

  /**
   * The Processing failed at a step; a retry will resume at that step. False
   * when it is no longer in one of the `dueStatuses`: a Processing that
   * already completed or failed keeps its outcome.
   */
  async markFailed(
    processingId: string,
    dueStatuses: readonly TrackProcessingStatus[],
    failure: {
      code: TrackProcessingFailureCode;
      resumeFrom: TrackProcessingStep;
    },
  ): Promise<boolean> {
    const rows = await this.txHost.tx
      .update(trackProcessings)
      .set({
        status: 'FAILED',
        failureCode: failure.code,
        resumeFrom: failure.resumeFrom,
        finishedAt: new Date(),
      })
      .where(processingInStatus(processingId, dueStatuses))
      .returning({ id: trackProcessings.id });
    return rows.length > 0;
  }
}

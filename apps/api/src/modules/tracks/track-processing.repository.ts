import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type {
  TrackProcessingFailureCode,
  TrackProcessingStatus,
  TrackProcessingStep,
  TrackProcessingVideoSource,
} from '@notefinder/contracts';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
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

  /** A step started: the status moves to it, the first start is kept. */
  async markStepStarted(
    processingId: string,
    step: TrackProcessingStep,
  ): Promise<void> {
    await this.txHost.tx
      .update(trackProcessings)
      .set({
        status: step,
        startedAt: sql`coalesce(${trackProcessings.startedAt}, now())`,
      })
      .where(eq(trackProcessings.id, processingId));
  }

  /** The video a Processing chose, and where it was found. */
  async saveVideo(
    processingId: string,
    video: { videoId: string; source: TrackProcessingVideoSource },
  ): Promise<void> {
    await this.txHost.tx
      .update(trackProcessings)
      .set({ videoId: video.videoId, videoSource: video.source })
      .where(eq(trackProcessings.id, processingId));
  }

  /** The Processing completed; nothing of it is left to run. */
  async markCompleted(processingId: string): Promise<void> {
    await this.txHost.tx
      .update(trackProcessings)
      .set({
        status: 'COMPLETED',
        failureCode: null,
        resumeFrom: null,
        finishedAt: new Date(),
      })
      .where(eq(trackProcessings.id, processingId));
  }

  /** The Processing failed at a step; a retry will resume at that step. */
  async markFailed(
    processingId: string,
    failure: {
      code: TrackProcessingFailureCode;
      resumeFrom: TrackProcessingStep;
    },
  ): Promise<void> {
    await this.txHost.tx
      .update(trackProcessings)
      .set({
        status: 'FAILED',
        failureCode: failure.code,
        resumeFrom: failure.resumeFrom,
        finishedAt: new Date(),
      })
      .where(eq(trackProcessings.id, processingId));
  }
}

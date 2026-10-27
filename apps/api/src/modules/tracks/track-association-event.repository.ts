import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../../database/database.js';
import { trackAssociationEvents } from '../../database/schema/track-association-events.js';

export type ClaimedTrackAssociation = {
  id: string;
  recordingMbid: string;
  trackId: string;
  attempts: number;
};

/** Durable queue state for Track links that the Music catalog has not acknowledged. */
@Injectable()
export class TrackAssociationEventRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async claimPending(
    now: Date,
    claimExpiresAt: Date,
    limit: number,
  ): Promise<ClaimedTrackAssociation[]> {
    const due = this.db
      .select({ id: trackAssociationEvents.id })
      .from(trackAssociationEvents)
      .where(
        and(
          isNull(trackAssociationEvents.deliveredAt),
          lte(trackAssociationEvents.nextAttemptAt, now),
          or(
            isNull(trackAssociationEvents.claimedUntil),
            lte(trackAssociationEvents.claimedUntil, now),
          ),
        ),
      )
      .orderBy(
        asc(trackAssociationEvents.nextAttemptAt),
        asc(trackAssociationEvents.createdAt),
      )
      .limit(limit)
      .for('update', { skipLocked: true });

    return this.db
      .update(trackAssociationEvents)
      .set({
        claimedUntil: claimExpiresAt,
        attempts: sql`${trackAssociationEvents.attempts} + 1`,
      })
      .where(inArray(trackAssociationEvents.id, due))
      .returning({
        id: trackAssociationEvents.id,
        recordingMbid: trackAssociationEvents.recordingMbid,
        trackId: trackAssociationEvents.trackId,
        attempts: trackAssociationEvents.attempts,
      });
  }

  /** Records delivery only after the catalog's durable acknowledgment. */
  async markDelivered(id: string, deliveredAt: Date): Promise<void> {
    await this.db
      .update(trackAssociationEvents)
      .set({ deliveredAt, claimedUntil: null })
      .where(
        and(
          eq(trackAssociationEvents.id, id),
          isNull(trackAssociationEvents.deliveredAt),
        ),
      );
  }

  /** Releases a failed claim with durable exponential backoff. */
  async scheduleRetry(id: string, nextAttemptAt: Date): Promise<void> {
    await this.db
      .update(trackAssociationEvents)
      .set({ nextAttemptAt, claimedUntil: null })
      .where(
        and(
          eq(trackAssociationEvents.id, id),
          isNull(trackAssociationEvents.deliveredAt),
        ),
      );
  }

  /** Deletes at most one old delivered page; pending events are never eligible. */
  async deleteDeliveredBefore(cutoff: Date, limit: number): Promise<number> {
    const expired = this.db
      .select({ id: trackAssociationEvents.id })
      .from(trackAssociationEvents)
      .where(lt(trackAssociationEvents.deliveredAt, cutoff))
      .orderBy(asc(trackAssociationEvents.deliveredAt))
      .limit(limit);
    const deleted = await this.db
      .delete(trackAssociationEvents)
      .where(inArray(trackAssociationEvents.id, expired))
      .returning({ id: trackAssociationEvents.id });
    return deleted.length;
  }

  async enqueueSynchronizationPage(
    rows: { id: string; recordingMbid: string }[],
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.db
      .insert(trackAssociationEvents)
      .values(
        rows.map((row) => ({
          trackId: row.id,
          recordingMbid: row.recordingMbid,
        })),
      )
      .onConflictDoUpdate({
        target: trackAssociationEvents.trackId,
        set: {
          recordingMbid: sql`excluded.recording_mbid`,
          attempts: 0,
          nextAttemptAt: new Date(),
          claimedUntil: null,
          deliveredAt: null,
        },
      });
  }

  countPendingForTracks(trackIds: string[]): Promise<{ count: number }[]> {
    return this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(trackAssociationEvents)
      .where(
        and(
          inArray(trackAssociationEvents.trackId, trackIds),
          isNull(trackAssociationEvents.deliveredAt),
        ),
      );
  }

  countPending(): Promise<{ count: number }[]> {
    return this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(trackAssociationEvents)
      .where(isNull(trackAssociationEvents.deliveredAt));
  }
}

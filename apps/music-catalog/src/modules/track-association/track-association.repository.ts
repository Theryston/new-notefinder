import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import { withCatalogWriteLock } from '../../database/catalog-write-lock.js';
import type { Database } from '../../database/database.js';
import type { DatabaseSource } from '../../database/database-ref.js';
import { reimportState } from '../../database/schema/reimport-state.js';
import { trackAssociation } from '../../database/schema/track-association.js';

export type TrackAssociation = { mbid: string; trackId: string | null };

export class TrackAssociationRepository {
  private readonly getServing: () => Database;
  private readonly getServingUrl: () => string;

  constructor(
    serving: DatabaseSource,
    servingUrl: string | (() => string) = '',
    private readonly nextCopy?: { db: Database; url: string },
  ) {
    this.getServing = typeof serving === 'function' ? serving : () => serving;
    this.getServingUrl =
      typeof servingUrl === 'function' ? servingUrl : () => servingUrl;
  }

  /** Acknowledges only after each live copy has durably stored retry work. */
  async put(association: TrackAssociation): Promise<boolean> {
    return withCatalogWriteLock(this.getServing(), async (transaction) => {
      const [state] = await transaction
        .select({ phase: reimportState.phase, detail: reimportState.detail })
        .from(reimportState)
        .where(eq(reimportState.id, true))
        .limit(1);
      if (state?.phase === 'switching') {
        return 'switching' as const;
      }
      const shouldMirror =
        this.nextCopy !== undefined &&
        this.nextCopy.url !== this.getServingUrl() &&
        (state?.phase === 'restoring' || state?.phase === 'indexing');
      const staleCopy =
        state?.phase === 'switched' &&
        state.detail !== null &&
        state.detail !== this.getServingUrl();
      if (state?.phase === 'switching' || staleCopy) {
        return 'switching' as const;
      }
      if (shouldMirror && this.nextCopy !== undefined) {
        await withCatalogWriteLock(
          this.nextCopy.db,
          async (nextTransaction) => {
            await this.upsert(nextTransaction, association);
          },
        );
      }
      await this.upsert(transaction, association);
      return 'accepted' as const;
    }).then((outcome) => outcome === 'accepted');
  }

  async peekPending(limit: number): Promise<string[]> {
    const rows = await this.getServing()
      .select({ mbid: trackAssociation.recordingMbid })
      .from(trackAssociation)
      .where(eq(trackAssociation.pending, true))
      .orderBy(asc(trackAssociation.recordingMbid))
      .limit(limit);
    return rows.map((row) => row.mbid);
  }

  async markIndexed(mbids: readonly string[]): Promise<void> {
    if (mbids.length === 0) return;
    await this.getServing()
      .update(trackAssociation)
      .set({ pending: false })
      .where(
        and(
          inArray(trackAssociation.recordingMbid, [...mbids]),
          eq(trackAssociation.pending, true),
        ),
      );
  }

  async transferTo(nextCopy: Database, batchSize: number): Promise<void> {
    let afterMbid: string | undefined;
    const serving = this.getServing();
    while (true) {
      const rows = await withCatalogWriteLock(serving, async () => {
        const page = await serving
          .select({
            mbid: trackAssociation.recordingMbid,
            trackId: trackAssociation.trackId,
          })
          .from(trackAssociation)
          .where(
            afterMbid === undefined
              ? undefined
              : gt(trackAssociation.recordingMbid, afterMbid),
          )
          .orderBy(asc(trackAssociation.recordingMbid))
          .limit(batchSize);
        if (page.length > 0) {
          await withCatalogWriteLock(nextCopy, async (transaction) => {
            for (const row of page) {
              await transaction
                .insert(trackAssociation)
                .values({
                  recordingMbid: row.mbid,
                  trackId: row.trackId,
                  pending: true,
                })
                .onConflictDoUpdate({
                  target: trackAssociation.recordingMbid,
                  set: { trackId: row.trackId, pending: true },
                });
            }
          });
        }
        return page;
      });
      if (rows.length === 0) return;
      afterMbid = rows.at(-1)?.mbid ?? afterMbid;
    }
  }

  private async upsert(
    transaction: Parameters<Parameters<Database['transaction']>[0]>[0],
    association: TrackAssociation,
  ): Promise<void> {
    await transaction
      .insert(trackAssociation)
      .values({
        recordingMbid: association.mbid,
        trackId: association.trackId,
        pending: true,
      })
      .onConflictDoUpdate({
        target: trackAssociation.recordingMbid,
        set: {
          trackId: association.trackId,
          pending: true,
          updatedAt: new Date(),
        },
      });
  }
}

import type { ReplicationStallReason } from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import type { Database } from '../../database/database.js';
import type { DatabaseSource } from '../../database/database-ref.js';
import { replicationControl } from '../../database/schema/musicbrainz/replication-control.js';
import { replicationState } from '../../database/schema/replication-state.js';

/** Why `mbslave sync` cannot apply packets, when it cannot. */
export type ReplicationStall = {
  reason: ReplicationStallReason;
  /** mbslave's message, truncated for `status`. */
  detail: string | null;
  /** The mbslave release that saw the stall (`MBSLAVE_REF`). */
  mbslaveRef: string | null;
};

/** What recording a stall writes: the release is missing away from sync. */
export type RecordReplicationStall = {
  reason: ReplicationStallReason;
  detail: string | null;
  mbslaveRef?: string;
};

/**
 * The replication sequence: what mbslave applied (`replication_control`,
 * mbslave's own cursor) and what this service recorded of it
 * (`replication_state`, our copy for `status`). Only the sequence moves
 * through here; the packets themselves are mbslave's.
 */
export class ReplicationRepository {
  private readonly getDb: () => Database;

  constructor(db: DatabaseSource) {
    this.getDb = typeof db === 'function' ? db : () => db;
  }

  /**
   * The last sequence this service recorded, or null until the first packet
   * lands (and always null in `tiny`, where replication stays off).
   */
  async lastRecordedSequence(): Promise<number | null> {
    const [state] = await this.getDb()
      .select({ lastSequence: replicationState.lastSequence })
      .from(replicationState)
      .limit(1);
    return state?.lastSequence ?? null;
  }

  /**
   * Records the sequence `mbslave sync` just applied, creating the single row
   * or moving it forward. Retried packets converge on the same row, so
   * recording twice changes nothing.
   */
  async recordSequence(sequence: number): Promise<void> {
    await this.getDb()
      .insert(replicationState)
      .values({ lastSequence: sequence })
      .onConflictDoUpdate({
        target: replicationState.id,
        set: { lastSequence: sequence },
      });
  }

  /**
   * What mbslave's cursor says it applied last: the dump's
   * `REPLICATION_SEQUENCE` before the first packet, then one step per
   * applied packet. Null while the table holds no row or no sequence (an
   * empty `replication_control`, like the seed leaves it).
   */
  async readAppliedSequence(): Promise<number | null> {
    const [control] = await this.getDb()
      .select({
        sequence: replicationControl.currentReplicationSequence,
      })
      .from(replicationControl)
      .limit(1);
    return control?.sequence ?? null;
  }

  /** Why sync cannot apply packets, or undefined while it can. */
  async readStall(): Promise<ReplicationStall | undefined> {
    const [state] = await this.getDb()
      .select({
        reason: replicationState.stalledReason,
        detail: replicationState.stalledDetail,
        mbslaveRef: replicationState.stalledMbslaveRef,
      })
      .from(replicationState)
      .limit(1);
    if (state?.reason === null || state?.reason === undefined) {
      return undefined;
    }
    return {
      reason: state.reason as ReplicationStallReason,
      detail: state.detail,
      mbslaveRef: state.mbslaveRef,
    };
  }

  /**
   * Records that `mbslave sync` cannot apply packets (the yearly schema
   * change): the reason with mbslave's message, anchored on its cursor, so
   * `status` shows the stall while the container crash-loops. The recorded
   * sequence never moves here: a failed sync applied nothing. Without a
   * cursor to anchor on (no row yet and nothing applied), only an existing
   * row is marked.
   */
  async recordStall(stall: RecordReplicationStall): Promise<void> {
    const columns = {
      stalledReason: stall.reason,
      stalledDetail: stall.detail,
      stalledMbslaveRef: stall.mbslaveRef ?? null,
    };
    const applied = await this.readAppliedSequence();
    if (applied === null) {
      await this.getDb()
        .update(replicationState)
        .set(columns)
        .where(eq(replicationState.id, true));
      return;
    }
    await this.getDb()
      .insert(replicationState)
      .values({ lastSequence: applied, ...columns })
      .onConflictDoUpdate({
        target: replicationState.id,
        set: columns,
      });
  }

  /**
   * Forgets the stall: replication applies packets again (or the reimport
   * replaced the copy). Only writes when a stall is set, so a healthy sync
   * never refreshes `updatedAt`, which operators read as "when the sequence
   * last moved".
   */
  async clearStall(): Promise<void> {
    if ((await this.readStall()) === undefined) {
      return;
    }
    await this.getDb()
      .update(replicationState)
      .set({
        stalledReason: null,
        stalledDetail: null,
        stalledMbslaveRef: null,
      })
      .where(eq(replicationState.id, true));
  }
}

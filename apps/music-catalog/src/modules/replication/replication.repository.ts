import type { Database } from '../../database/database.js';
import { replicationControl } from '../../database/schema/musicbrainz/replication-control.js';
import { replicationState } from '../../database/schema/replication-state.js';

/**
 * The replication sequence: what mbslave applied (`replication_control`,
 * mbslave's own cursor) and what this service recorded of it
 * (`replication_state`, our copy for `status`). Only the sequence moves
 * through here; the packets themselves are mbslave's.
 */
export class ReplicationRepository {
  constructor(private readonly db: Database) {}

  /**
   * The last sequence this service recorded, or null until the first packet
   * lands (and always null in `sample`, where replication stays off).
   */
  async lastRecordedSequence(): Promise<number | null> {
    const [state] = await this.db
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
    await this.db
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
   * empty `replication_control`, like the sample ships).
   */
  async readAppliedSequence(): Promise<number | null> {
    const [control] = await this.db
      .select({
        sequence: replicationControl.currentReplicationSequence,
      })
      .from(replicationControl)
      .limit(1);
    return control?.sequence ?? null;
  }
}

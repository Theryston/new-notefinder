import type { ReimportPhase } from '@notefinder/contracts';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../../database/database.js';
import type { DatabaseSource } from '../../database/database-ref.js';
import { reimportState } from '../../database/schema/reimport-state.js';

/**
 * Where the blue-green reimport stands. After the flip the phase is
 * `switched` with the new serving database in `detail`, so a restarted
 * process opens the new copy; the next reimport overwrites the row.
 */
export type ReimportState = {
  phase: ReimportPhase | 'switched';
  progressPct: number | null;
  detail: string | null;
};

export class ReimportStateRepository {
  private readonly getDb: () => Database;

  constructor(db: DatabaseSource) {
    this.getDb = typeof db === 'function' ? db : () => db;
  }

  /** The reimport state, or undefined when no reimport is running. */
  async get(): Promise<ReimportState | undefined> {
    const [state] = await this.getDb()
      .select({
        phase: reimportState.phase,
        progressPct: reimportState.progressPct,
        detail: reimportState.detail,
      })
      .from(reimportState)
      .limit(1);
    return state as ReimportState | undefined;
  }

  /** Starts the reimport: the parallel copy begins in `restoring`. */
  async start(detail?: string): Promise<void> {
    await this.getDb()
      .insert(reimportState)
      .values({ phase: 'restoring', detail: detail ?? null })
      .onConflictDoUpdate({
        target: reimportState.id,
        set: { phase: 'restoring', progressPct: null, detail: detail ?? null },
      });
  }

  /**
   * Moves the phase from `from` to `to`, only if it is still `from`: a
   * process that lost a race with a restart changes nothing instead of
   * skipping a step behind its back.
   */
  async advance(move: {
    from: ReimportState['phase'];
    to: ReimportState['phase'];
  }): Promise<void> {
    await this.getDb()
      .update(reimportState)
      .set({ phase: move.to, progressPct: null })
      .where(
        and(eq(reimportState.id, true), eq(reimportState.phase, move.from)),
      );
  }

  /** Records the indexing progress, 0 to 100. */
  async setProgress(progressPct: number): Promise<void> {
    await this.getDb()
      .update(reimportState)
      .set({ progressPct })
      .where(eq(reimportState.id, true));
  }

  /**
   * Records the flip: the new serving database lives in `detail`. Upserts,
   * so the parallel copy (which holds no reimport row yet) records it too:
   * a restart reads the serving copy's row, and the retired database may
   * be dropped afterwards.
   */
  async markSwitched(servingDatabaseUrl: string): Promise<void> {
    await this.getDb()
      .insert(reimportState)
      .values({ phase: 'switched', detail: servingDatabaseUrl })
      .onConflictDoUpdate({
        target: reimportState.id,
        set: {
          phase: 'switched',
          progressPct: null,
          detail: servingDatabaseUrl,
        },
      });
  }

  /**
   * Drops a database from the server (the retired copy after the flip).
   * Runs on any connection except one to the database itself, which the
   * caller guarantees by connecting through the new copy. Backends still
   * on it are terminated first, so in-flight readers fail instead of
   * blocking the drop.
   */
  async dropDatabase(databaseName: string): Promise<void> {
    const db = this.getDb();
    await db.execute(sql`
      select pg_terminate_backend(pid) from pg_stat_activity
      where datname = ${databaseName} and pid <> pg_backend_pid()
    `);
    await db.execute(
      sql`drop database if exists ${sql.identifier(databaseName)}`,
    );
  }
}

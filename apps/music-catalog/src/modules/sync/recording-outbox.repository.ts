import { count, sql } from 'drizzle-orm';
import type { Database } from '../../database/database.js';
import type { DatabaseSource } from '../../database/database-ref.js';
import { recordingOutbox } from '../../database/schema/recording-outbox.js';
import type { OutboxEntry } from './sync-plan.js';
import {
  buildSyncTriggersSql,
  planTriggerSync,
  SYNC_FUNCTION_PREFIX,
  SYNC_TRIGGER_PREFIX,
} from './sync-tracked-tables.js';

type SyncTriggerRow = { name: string; table: string };

/**
 * The recording outbox: entries the change triggers wrote, and the triggers
 * themselves. The triggers live on mbslave's tables, so they are installed
 * here with plain SQL (never a migration); the outbox table itself is ours
 * and migrated normally.
 */
export class RecordingOutboxRepository {
  private readonly getDb: () => Database;

  constructor(db: DatabaseSource) {
    this.getDb = typeof db === 'function' ? db : () => db;
  }

  /** The oldest entries still waiting to reach the index. */
  async peekPending(limit: number): Promise<OutboxEntry[]> {
    const rows = await this.getDb()
      .select({
        recordingId: recordingOutbox.recordingId,
        recordingMbid: recordingOutbox.recordingMbid,
        enqueuedAt: recordingOutbox.enqueuedAt,
      })
      .from(recordingOutbox)
      .where(sql`${recordingOutbox.processedAt} IS NULL`)
      .orderBy(recordingOutbox.enqueuedAt)
      .limit(limit);
    return rows.map((row) => ({
      recordingId: row.recordingId,
      recordingMbid: row.recordingMbid,
      enqueuedAt: row.enqueuedAt,
    }));
  }

  /**
   * How many entries still wait to reach the index. Replication logs it next
   * to every applied packet and `status` reports it, so operators see the lag
   * behind the last applied sequence.
   */
  async countPending(): Promise<number> {
    const [row] = await this.getDb()
      .select({ pending: count() })
      .from(recordingOutbox)
      .where(sql`${recordingOutbox.processedAt} IS NULL`);
    return row?.pending ?? 0;
  }

  /**
   * Drops every entry: the reimport switched copies, so entries queued
   * against the retired copy are meaningless on the new one (its own
   * outbox carries its changes). Replication re-enqueues real lag from its
   * cursor afterwards.
   */
  async clearAll(): Promise<void> {
    await this.getDb().delete(recordingOutbox);
  }

  /**
   * Marks entries done after their changes reached the index. Only the
   * batch's own entries are marked (matched by key, and only while still
   * pending), so a change written while the batch was syncing waits for the
   * next one instead of being swallowed.
   */
  async markProcessed(entries: readonly OutboxEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }
    const keys = sql.join(
      entries.map(
        (entry) => sql`(${entry.recordingId}, ${entry.recordingMbid}::uuid)`,
      ),
      sql`, `,
    );
    await this.getDb().execute(sql`
      update music_catalog.recording_outbox
      set processed_at = now()
      where (recording_id, recording_mbid) in (${keys})
        and processed_at is null
    `);
  }

  /**
   * Installs (or replaces) every change trigger when any is missing or
   * stale, and drops sync triggers and functions of tables this version no
   * longer tracks. Safe to call on every start: when everything is in place
   * it is two lookups that change nothing.
   */
  async ensureTriggers(): Promise<void> {
    const [triggers, functions] = await Promise.all([
      this.listSyncTriggers(),
      this.listSyncFunctions(),
    ]);
    const plan = planTriggerSync({ triggers, functions });
    for (const trigger of plan.staleTriggers) {
      await this.getDb().execute(
        sql`drop trigger if exists ${sql.identifier(trigger.name)} on ${sql.identifier('musicbrainz')}.${sql.identifier(trigger.table)}`,
      );
    }
    for (const name of plan.staleFunctions) {
      await this.getDb().execute(
        sql`drop function if exists ${sql.identifier('music_catalog')}.${sql.identifier(name)}()`,
      );
    }
    if (!plan.reinstall) {
      return;
    }
    await this.getDb().execute(sql.raw(buildSyncTriggersSql()));
  }

  private async listSyncTriggers(): Promise<SyncTriggerRow[]> {
    // `\_` keeps the prefix's own underscore from matching any character.
    const prefixPattern = `${SYNC_TRIGGER_PREFIX}\\_%`;
    const result = await this.getDb().execute<SyncTriggerRow>(sql`
      select t.tgname as "name", c.relname as "table"
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'musicbrainz'
        and t.tgname like ${prefixPattern}
        and not t.tgisinternal
    `);
    return result.rows;
  }

  private async listSyncFunctions(): Promise<string[]> {
    const prefixPattern = `${SYNC_FUNCTION_PREFIX}\\_%`;
    const result = await this.getDb().execute<{ name: string }>(sql`
      select p.proname as "name"
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'music_catalog'
        and p.proname like ${prefixPattern}
    `);
    return result.rows.map((row) => row.name);
  }
}

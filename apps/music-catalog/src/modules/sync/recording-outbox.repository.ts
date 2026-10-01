import { sql } from 'drizzle-orm';
import type { Database } from '../../database/database.js';
import { recordingOutbox } from '../../database/schema/recording-outbox.js';
import type { OutboxEntry } from './sync-plan.js';
import {
  buildSyncTriggersSql,
  SYNC_TRIGGER_PREFIX,
  TRACKED_TABLES,
  triggerName,
} from './sync-tracked-tables.js';

type SyncTriggerRow = { name: string; table: string };

/**
 * The recording outbox: entries the change triggers wrote, and the triggers
 * themselves. The triggers live on mbslave's tables, so they are installed
 * here with plain SQL (never a migration); the outbox table itself is ours
 * and migrated normally.
 */
export class RecordingOutboxRepository {
  constructor(private readonly db: Database) {}

  /** The oldest entries still waiting to reach the index. */
  async peekPending(limit: number): Promise<OutboxEntry[]> {
    const rows = await this.db
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
    await this.db.execute(sql`
      update music_catalog.recording_outbox
      set processed_at = now()
      where (recording_id, recording_mbid) in (${keys})
        and processed_at is null
    `);
  }

  /**
   * Installs (or replaces) every change trigger when any is missing or stale,
   * and drops sync triggers of tables this version no longer tracks. Safe to
   * call on every start: when everything is in place it is a single lookup.
   */
  async ensureTriggers(): Promise<void> {
    const existing = await this.listSyncTriggers();
    const expected = new Set(
      TRACKED_TABLES.map((entry) => triggerName(entry.table)),
    );
    const missing = [...expected].filter(
      (name) => !existing.some((row) => row.name === name),
    );
    const stale = existing.filter((row) => !expected.has(row.name));
    for (const row of stale) {
      await this.db.execute(
        sql`drop trigger if exists ${sql.identifier(row.name)} on ${sql.identifier('musicbrainz')}.${sql.identifier(row.table)}`,
      );
    }
    if (missing.length === 0 && stale.length === 0) {
      return;
    }
    await this.db.execute(sql.raw(buildSyncTriggersSql()));
  }

  private async listSyncTriggers(): Promise<SyncTriggerRow[]> {
    // `\_` keeps the prefix's own underscore from matching any character.
    const prefixPattern = `${SYNC_TRIGGER_PREFIX}\\_%`;
    const result = await this.db.execute<SyncTriggerRow>(sql`
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
}

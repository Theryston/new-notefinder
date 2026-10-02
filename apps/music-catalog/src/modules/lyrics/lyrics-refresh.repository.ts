import type { Database } from '../../database/database.js';
import { lrclibRefreshState } from '../../database/schema/lrclib-refresh-state.js';

/** Where the Lyrics refresh stands: nulls until the first check ran. */
export type LrclibRefreshState = {
  lastDumpKey: string | null;
  lastCheckedAt: Date | null;
  lastImportedAt: Date | null;
};

/**
 * The Lyrics refresh state: a single row remembering the latest dump key the
 * listing pointed at and when it was checked and imported. Only the refresh
 * and the first import write it, so the refresh skips dumps it (or the
 * import) already brought in.
 */
export class LyricsRefreshRepository {
  constructor(private readonly db: Database) {}

  async getState(): Promise<LrclibRefreshState> {
    const [row] = await this.db.select().from(lrclibRefreshState).limit(1);
    return {
      lastDumpKey: row?.lastDumpKey ?? null,
      lastCheckedAt: row?.lastCheckedAt ?? null,
      lastImportedAt: row?.lastImportedAt ?? null,
    };
  }

  /** Remembers a listing poll, successful or not, so it is not retried at once. */
  async recordCheck(now: Date, dumpKey: string | null): Promise<void> {
    await this.db
      .insert(lrclibRefreshState)
      .values({ id: true, lastDumpKey: dumpKey, lastCheckedAt: now })
      .onConflictDoUpdate({
        target: lrclibRefreshState.id,
        set: { lastDumpKey: dumpKey, lastCheckedAt: now },
      });
  }

  /** Remembers a finished dump refresh, so it is skipped from now on. */
  async recordImport(now: Date, dumpKey: string): Promise<void> {
    await this.db
      .insert(lrclibRefreshState)
      .values({
        id: true,
        lastDumpKey: dumpKey,
        lastCheckedAt: now,
        lastImportedAt: now,
      })
      .onConflictDoUpdate({
        target: lrclibRefreshState.id,
        set: {
          lastDumpKey: dumpKey,
          lastCheckedAt: now,
          lastImportedAt: now,
        },
      });
  }
}

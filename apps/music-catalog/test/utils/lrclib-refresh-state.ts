import type { Database } from '../../src/database/database.js';
import { lrclibRefreshState } from '../../src/database/schema/lrclib-refresh-state.js';

/**
 * Writes the refresh row, as the first import and the refresh would: the
 * checked key with when it was polled, and the imported key with when it
 * landed. Pass dates in the past to age the row past the check or minimum
 * intervals.
 */
export const setRefreshState = async (
  db: Database,
  state: Pick<
    typeof lrclibRefreshState.$inferInsert,
    'lastDumpKey' | 'lastCheckedAt' | 'lastImportedAt'
  >,
): Promise<void> => {
  await db
    .insert(lrclibRefreshState)
    .values({ id: true, ...state })
    .onConflictDoUpdate({
      target: lrclibRefreshState.id,
      set: state,
    });
};

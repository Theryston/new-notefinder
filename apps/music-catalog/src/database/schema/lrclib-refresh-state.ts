import { sql } from 'drizzle-orm';
import { boolean, check, text, timestamp } from 'drizzle-orm/pg-core';
import { musicCatalog } from './music-catalog-schema.js';

/**
 * Where the Lyrics refresh stands: the last dump the worker checked and the
 * last one it imported. A single row. No row until the first check ran (and
 * never one in `tiny`, where the refresh never touches the network).
 * `lastImportedAt` gates the minimum interval between two dump refreshes, so
 * a newer listing key alone never re-downloads the same file, and
 * `lastCheckedAt` gates the listing poll itself.
 */
export const lrclibRefreshState = musicCatalog.table(
  'lrclib_refresh_state',
  {
    // Always true: together with the check below it keeps the table to one row.
    id: boolean().primaryKey().default(true),
    /** The key of the latest dump the listing pointed at, when last checked. */
    lastDumpKey: text(),
    /** When the listing was last polled, successful or not. */
    lastCheckedAt: timestamp({ withTimezone: true }),
    /** When a newer dump was last imported. */
    lastImportedAt: timestamp({ withTimezone: true }),
  },
  (table) => [check('lrclib_refresh_state_single_row', sql`${table.id}`)],
);

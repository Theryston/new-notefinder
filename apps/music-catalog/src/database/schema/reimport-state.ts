import { sql } from 'drizzle-orm';
import { boolean, check, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { musicCatalog } from './music-catalog-schema.js';

/**
 * Where the blue-green reimport stands (issue #69): the parallel copy the
 * yearly MusicBrainz schema change rebuilds next to the serving one. A
 * single row, written by the mbslave container (`restoring`) and the worker
 * (`indexing`, `switching`, then cleared). No row means no reimport is
 * running, and the first import's `bootstrap_state` phase stays `ready`
 * throughout, so the catalog keeps serving from the current copy.
 */
export const reimportState = musicCatalog.table(
  'reimport_state',
  {
    // Always true: together with the check below it keeps the table to one row.
    id: boolean().primaryKey().default(true),
    // `restoring` (the new dump lands in the parallel copy), `indexing` (it
    // is indexed into the `*_next` search indexes) or `switching` (the
    // serving copy flips over). `switched` is recorded after the flip with
    // the new serving database in `detail`, so a restarted process opens the
    // new copy; it is overwritten by the next reimport.
    phase: text().notNull(),
    // 0 to 100 while indexing, null otherwise.
    progressPct: integer(),
    // The new serving database URL once `switched`, else null.
    detail: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [check('reimport_state_single_row', sql`${table.id}`)],
);

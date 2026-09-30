import { BOOTSTRAP_PHASES, CATALOG_DATASETS } from '@notefinder/contracts';
import { sql } from 'drizzle-orm';
import { boolean, check, timestamp } from 'drizzle-orm/pg-core';
import { musicCatalog } from './music-catalog-schema.js';

// The values come from the protocol's constants, so the database and the
// `status` response can't drift apart. They are passed as a tuple, not as
// Zod's `.enum` object: drizzle-kit drops the Postgres schema from the column
// types of an enum declared from an object.
export const bootstrapPhase = musicCatalog.enum(
  'bootstrap_phase',
  BOOTSTRAP_PHASES,
);

export const catalogDataset = musicCatalog.enum(
  'catalog_dataset',
  CATALOG_DATASETS,
);

/**
 * How far the first import got: a single row. The mbslave container creates
 * it and records `restoring` and `restored`; the worker then records
 * `indexing` and `ready`. Until the row exists the import has not started, and
 * the catalog is still `restoring`.
 */
export const bootstrapState = musicCatalog.table(
  'bootstrap_state',
  {
    // Always true: together with the check below it keeps the table to one row.
    id: boolean().primaryKey().default(true),
    phase: bootstrapPhase().notNull().default('restoring'),
    dataset: catalogDataset().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [check('bootstrap_state_single_row', sql`${table.id}`)],
);

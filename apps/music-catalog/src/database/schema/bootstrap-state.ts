import {
  bootstrapPhaseSchema,
  catalogDatasetSchema,
} from '@notefinder/contracts';
import { sql } from 'drizzle-orm';
import { boolean, check, timestamp } from 'drizzle-orm/pg-core';
import { musicCatalog } from './music-catalog-schema.js';

// The values come from the protocol's schemas, so the database and the
// `status` response can't drift apart.
export const bootstrapPhase = musicCatalog.enum(
  'bootstrap_phase',
  bootstrapPhaseSchema.enum,
);

export const catalogDataset = musicCatalog.enum(
  'catalog_dataset',
  catalogDatasetSchema.enum,
);

/**
 * How far the first import got: a single row, written by the worker. Until it
 * exists the import has not started, and the catalog is still `restoring`.
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

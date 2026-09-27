import type { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema>;

/**
 * Transactional adapter type for `TransactionHost`. Repositories inject
 * `txHost: TransactionHost<DatabaseAdapter>` and query through `txHost.tx`,
 * which is the active transaction inside `@Transactional()` and the plain
 * client outside of one.
 */
export type DatabaseAdapter = TransactionalAdapterDrizzleOrm<Database>;

/** Injection token for the Drizzle client: `@Inject(DATABASE) db: Database`. */
export const DATABASE = Symbol('DATABASE');

/** Injection token for the underlying node-postgres pool. */
export const DATABASE_POOL = Symbol('DATABASE_POOL');

export const createPool = (connectionString: string): Pool =>
  new Pool({ connectionString });

// `casing` must match drizzle.config.ts so queries use the snake_case columns
// the migrations created.
export const createDatabase = (pool: Pool): Database =>
  drizzle({ client: pool, schema, casing: 'snake_case' });

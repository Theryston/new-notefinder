import { Client } from 'pg';
import { buildSyncTriggersSql } from '../../src/modules/sync/sync-tracked-tables.js';

/**
 * Installs the worker's change triggers on the MusicBrainz tables: the same
 * SQL the worker installs in production, so the fixture writes the specs
 * make (plain SQL, the way a dump or a replication packet would write) reach
 * the outbox. Idempotent, so a reused `E2E_DATABASE_URL` just gets them
 * (re)applied.
 */
export const applySyncTriggers = async (databaseUrl: string): Promise<void> => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(buildSyncTriggersSql());
  } finally {
    await client.end();
  }
};

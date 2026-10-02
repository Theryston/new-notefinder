import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import { inject } from 'vitest';
import type { Database } from '../../src/database/database.js';
import { createDatabase, createPool } from '../../src/database/database.js';
import { MbslaveClient } from '../../src/integrations/mbslave/mbslave-client.js';
import { ReimportStateRepository } from '../../src/modules/reimport/reimport-state.repository.js';
import { ReplicationRepository } from '../../src/modules/replication/replication.repository.js';
import { ReplicationService } from '../../src/modules/replication/replication.service.js';
import { RecordingOutboxRepository } from '../../src/modules/sync/recording-outbox.repository.js';
import { applyMusicBrainzSchema } from '../setup/musicbrainz-schema.js';
import { testLogger } from './create-test-server.js';
import { resetDatabase, setReplicationControl } from './database.js';
import {
  type FakeDumpServer,
  startFakeDumpServer,
} from './fake-dump-server.js';
import { meilisearchRequest } from './meilisearch-http.js';
import { addRecording, mbid } from './musicbrainz.js';

// Shared setup of the yearly schema-change suites (split from one file over
// the test-file size limit): the parallel database, the fake dump server,
// the stall and the new-dump seed. The per-test serving/restoring flows live
// in test/utils/reimport-flows.ts.
export type ParallelCopy = { url: string; db: Database };

/**
 * The parallel copy: a second database on the same server, migrated and
 * holding the real MusicBrainz schema like the mbslave container leaves it.
 * Created once per file; every test starts it empty (see
 * `useCleanParallelCopy`).
 */
export const useParallelDatabase = (): (() => ParallelCopy) => {
  let nextUrl = '';
  let nextPool: ReturnType<typeof createPool> | undefined;
  let nextDb: Database | undefined;
  const parallel = (): ParallelCopy => {
    if (nextDb === undefined) {
      throw new Error('The parallel database is only available inside a test');
    }
    return { url: nextUrl, db: nextDb };
  };

  beforeAll(async () => {
    const url = new URL(inject('databaseUrl'));
    url.pathname = `${url.pathname.replace(/\/$/, '')}_reimport`;
    nextUrl = url.toString();
    const admin = new Client({ connectionString: inject('databaseUrl') });
    await admin.connect();
    try {
      await admin.query(
        `DROP DATABASE IF EXISTS "${url.pathname.slice(1).replace(/"/g, '""')}"`,
      );
      await admin.query(
        `CREATE DATABASE "${url.pathname.slice(1).replace(/"/g, '""')}"`,
      );
    } finally {
      await admin.end();
    }
    nextPool = createPool(nextUrl, () => undefined);
    nextDb = createDatabase(nextPool);
    await migrate(nextDb, {
      migrationsFolder: fileURLToPath(
        new URL('../../drizzle', import.meta.url),
      ),
    });
    await applyMusicBrainzSchema(nextUrl);
  });

  afterAll(async () => {
    await nextPool?.end();
    // A switch test flips its server to the parallel database through pools
    // the suite does not own: terminate every backend before dropping it,
    // the way the service drops a retired copy.
    const adminPool = createPool(inject('databaseUrl'), () => undefined);
    try {
      const name = new URL(nextUrl).pathname.slice(1);
      await new ReimportStateRepository(createDatabase(adminPool)).dropDatabase(
        name,
      );
    } finally {
      await adminPool.end();
    }
  });

  return parallel;
};

// Production restores into a fresh parallel database per reimport, which has
// no change triggers until the worker installs them. The suites reuse one
// database, so a previous test's triggers are dropped to restore that
// precondition (resetting tables is not enough: seeding through leftover
// triggers would enqueue entries the fresh copy never has).
const dropParallelSyncTriggers = async (db: Database): Promise<void> => {
  const triggers = await db.execute<{ name: string; table: string }>(sql`
    select t.tgname as "name", c.relname as "table"
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'musicbrainz'
      and t.tgname like 'notefinder\_sync\_%'
      and not t.tgisinternal
  `);
  for (const trigger of triggers.rows) {
    await db.execute(sql`
      drop trigger ${sql.identifier(trigger.name)}
      on ${sql.identifier('musicbrainz')}.${sql.identifier(trigger.table)}
    `);
  }
  const functions = await db.execute<{ name: string }>(sql`
    select p.proname as "name"
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'music_catalog'
      and p.proname like 'sync\_outbox\_from\_%'
  `);
  for (const fn of functions.rows) {
    await db.execute(sql`
      drop function ${sql.identifier('music_catalog')}.${sql.identifier(fn.name)}()
    `);
  }
};

export const useCleanParallelCopy = (parallel: () => ParallelCopy): void => {
  beforeEach(async () => {
    await resetDatabase(parallel().db);
    await dropParallelSyncTriggers(parallel().db);
    // Fire and forget: Meilisearch runs tasks in order, so a delete queued
    // here finishes before anything the test enqueues (missing indexes 404,
    // which is fine).
    const meilisearch = inject('meilisearch');
    void meilisearchRequest(meilisearch, 'DELETE', '/indexes/recordings_next');
    void meilisearchRequest(meilisearch, 'DELETE', '/indexes/lyrics_next');
  });
};

export const useFakeDumps = (): (() => FakeDumpServer) => {
  let dumps: FakeDumpServer | undefined;
  beforeAll(async () => {
    dumps = await startFakeDumpServer();
  });
  afterAll(async () => {
    await dumps?.close();
    dumps = undefined;
  });
  beforeEach(() => {
    dumps?.forgetRequests();
  });
  return () => {
    if (dumps === undefined) {
      throw new Error('The fake dump server is only available inside a test');
    }
    return dumps;
  };
};

export const replicationWith = (
  db: Database,
  sync: () => Promise<void>,
): ReplicationService => {
  const sequences = new ReplicationRepository(db);
  return new ReplicationService({
    sequences,
    backlog: new RecordingOutboxRepository(db),
    mbslave: new MbslaveClient(sync),
    dataset: 'full',
    musicbrainzToken: 'e2e-token',
    stalls: sequences,
    mbslaveRef: 'v31.0.1',
    pollIntervalMs: 1,
    logger: testLogger,
  });
};

export const stallReplication = async (db: Database): Promise<void> => {
  const replication = replicationWith(db, async () => {
    throw new Error('mbslave sync failed (exit 1): Mismatched schema');
  });
  await expect(replication.replicateOnce()).rejects.toThrow(
    'Mismatched schema',
  );
};

export const seedNewDump = async (db: Database): Promise<void> => {
  await addRecording(db, {
    mbid: mbid(901),
    name: 'Same Take Song',
    lengthMs: 180_000,
  });
  await addRecording(db, {
    mbid: mbid(902),
    name: 'Resized Take Song',
    lengthMs: 200_000,
  });
  await addRecording(db, {
    mbid: mbid(903),
    name: 'Brand New Next Song',
    lengthMs: 200_000,
  });
  await addRecording(db, {
    mbid: mbid(904),
    name: 'Steady Control Song',
    lengthMs: 180_000,
  });
  await setReplicationControl(db, 200_001);
};

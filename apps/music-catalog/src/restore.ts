import { loadRestoreEnv, mbslaveSpawnEnv } from './config/env.js';
import { createCutoverWatcher } from './cutover-watcher.js';
import type { Database } from './database/database.js';
import { createDatabase, createPool } from './database/database.js';
import {
  databaseNameOf,
  openCutoverDatabase,
} from './database/database-ref.js';
import {
  createProcessMbslaveRun,
  MbslaveClient,
} from './integrations/mbslave/mbslave-client.js';
import { createShutdownSignal } from './lib/shutdown-signal.js';
import { createLogger } from './logger.js';
import { BootstrapRepository } from './modules/bootstrap/bootstrap.repository.js';
import { BootstrapService } from './modules/bootstrap/bootstrap.service.js';
import {
  fetchArchiveTotalBytes,
  resolveLatestDumpUrls,
} from './modules/bootstrap/dump-urls.js';
import { RestoreService } from './modules/bootstrap/restore.service.js';
import { TinySeedRepository } from './modules/bootstrap/tiny-seed.repository.js';
import { readReimportStateOf } from './modules/reimport/read-reimport-state.js';
import {
  needsParallelDatabaseWarning,
  ReimportRestoreService,
} from './modules/reimport/reimport-restore.service.js';
import { ReimportStateRepository } from './modules/reimport/reimport-state.repository.js';
import { resolveServingDatabaseUrl } from './modules/reimport/resolve-serving-url.js';
import { ReplicationRepository } from './modules/replication/replication.repository.js';
import { ReplicationService } from './modules/replication/replication.service.js';
import { RecordingOutboxRepository } from './modules/sync/recording-outbox.repository.js';

// The process the mbslave container runs on start: it lays the dataset down
// when needed, then replicates continuously in `full` mode (in `tiny` mode
// replication stays off and the container exits). The
// worker takes it from `restored` to `ready`; replication itself waits for
// `ready`, so every packet reaches the outbox through the worker's triggers.
// worker takes it from `restored` to `ready`; replication itself waits for
// `ready`, so every packet reaches the outbox through the worker's triggers.
const env = loadRestoreEnv();
const logger = createLogger({
  name: 'restore',
  json: env.NODE_ENV === 'production',
});
// A reimport may have flipped the serving copy since this container last
// ran: open the database the flip record points at.
const servingUrl = await resolveServingDatabaseUrl({
  configuredUrl: env.DATABASE_URL,
  reimportUrl: env.REIMPORT_DATABASE_URL,
  readReimportState: (url) =>
    readReimportStateOf(url, (error) => {
      logger.error('Database connection error', { error });
    }),
});
const pool = createPool(servingUrl, (error) => {
  logger.error('Database connection error', { error });
});
const db = createDatabase(pool);
// Every repository reads through the reference, so the cutover below can
// flip the container to the reimported copy without restarting it.
const dbRef: { current: Database } = { current: db };
const dbSource = (): Database => dbRef.current;
const mbslaveRun = createProcessMbslaveRun(
  undefined,
  (line, args) => {
    logger.info('mbslave output', { command: args[0] ?? '', line });
  },
  mbslaveSpawnEnv(),
);
const restore = new RestoreService({
  repository: new BootstrapRepository(dbSource),
  mbslave: new MbslaveClient(mbslaveRun),
  resolveUrls: resolveLatestDumpUrls,
  resolveTotalBytes: (urls) => fetchArchiveTotalBytes(urls),
  // `tiny` seeds Recordings with plain SQL after `init --empty`;
  // `full` resolves and imports the dump archives instead.
  seedTiny: () => new TinySeedRepository(dbSource).seed(),
  baseUrl: env.MUSICBRAINZ_DUMP_BASE_URL,
  dataset: env.CATALOG_DATASET,
  logger,
});
const sequences = new ReplicationRepository(dbSource);
const replication = new ReplicationService({
  sequences,
  backlog: new RecordingOutboxRepository(dbSource),
  mbslave: new MbslaveClient(mbslaveRun),
  dataset: env.CATALOG_DATASET,
  musicbrainzToken: env.MBSLAVE_MUSICBRAINZ_TOKEN,
  musicbrainzTokenFile: env.MBSLAVE_MUSICBRAINZ_TOKEN_FILE,
  stalls: sequences,
  mbslaveRef: env.MBSLAVE_REF,
  logger,
});
const bootstrap = new BootstrapService(
  new BootstrapRepository(dbSource),
  env.CATALOG_DATASET,
  replication,
  {
    cutover: createCutoverWatcher({
      readState: () => new ReimportStateRepository(dbSource).get(),
      openDatabase: (url) => openCutoverDatabase(url, logger),
      adopt: (database) => {
        dbRef.current = database;
      },
      logger,
    }),
  },
);
// The parallel restore, owned by this container (it has the mbslave
// binary): only wired with a parallel database to restore into.
const nextDatabaseUrl = env.REIMPORT_DATABASE_URL;
const nextDatabaseName =
  nextDatabaseUrl === undefined ? undefined : databaseNameOf(nextDatabaseUrl);
if (nextDatabaseUrl !== undefined && nextDatabaseName === undefined) {
  throw new Error(
    `REIMPORT_DATABASE_URL must name a database: '${nextDatabaseUrl}' ` +
      'has no database name.',
  );
}
const nextPool =
  nextDatabaseUrl === undefined
    ? undefined
    : createPool(nextDatabaseUrl, (error) => {
        logger.error('Database connection error', { error });
      });
const reimportRestore =
  nextPool === undefined ||
  nextDatabaseUrl === undefined ||
  nextDatabaseName === undefined
    ? undefined
    : new ReimportRestoreService({
        bootstrap,
        replication,
        state: new ReimportStateRepository(dbSource),
        nextState: {
          getState: () =>
            new BootstrapRepository(createDatabase(nextPool)).getState(),
        },
        restore: new RestoreService({
          repository: new BootstrapRepository(createDatabase(nextPool)),
          // The parallel restore targets the parallel database: mbslave
          // reads the database name from its own variables, so only it is
          // overridden (the serving connection above is untouched).
          mbslave: new MbslaveClient(
            createProcessMbslaveRun(
              undefined,
              (line, args) => {
                logger.info('mbslave output', {
                  command: args[0] ?? '',
                  line,
                });
              },
              {
                ...mbslaveSpawnEnv(),
                MBSLAVE_DB_DB: nextDatabaseName,
              },
            ),
          ),
          resolveUrls: resolveLatestDumpUrls,
          resolveTotalBytes: (urls) => fetchArchiveTotalBytes(urls),
          seedTiny: () =>
            new TinySeedRepository(createDatabase(nextPool)).seed(),
          baseUrl: env.MUSICBRAINZ_DUMP_BASE_URL,
          dataset: env.CATALOG_DATASET,
          logger,
        }),
        currentMbslaveRef: env.MBSLAVE_REF,
        servingDatabaseUrl: servingUrl,
        nextDatabaseUrl,
        dataset: env.CATALOG_DATASET,
        logger,
      });

// Aborting it stops the replication loop below after the sync in progress;
// the restore above always runs to completion, like the worker's batches.
const signal = createShutdownSignal(logger);

logger.info('Restore started', { dataset: env.CATALOG_DATASET });
let restored = false;
try {
  const outcome = await restore.run();
  logger.info('Restore service done', { outcome });
  restored = true;
} catch (error) {
  logger.error('Restore failed, the next start redoes it', { error });
  process.exitCode = 1;
} finally {
  if (!restored) {
    await pool.end();
    await nextPool?.end();
  }
}

// Without a parallel database a schema-change stall waits forever: the
// container crash-loops on sync and nothing rebuilds the catalog. The
// status already carries the stall; this names the exact setting to set, on
// both processes that need it, with the runbook that provisions it.
const warnWhenReimportUnconfigured = async (): Promise<void> => {
  const stall = await sequences.readStall().catch(() => undefined);
  if (
    !needsParallelDatabaseWarning({
      dataset: env.CATALOG_DATASET,
      stallReason: stall?.reason,
      hasParallelDatabase: nextPool !== undefined,
    })
  ) {
    return;
  }
  logger.warn(
    'Replication stalled on the yearly schema change but ' +
      'REIMPORT_DATABASE_URL is unset, so no reimport rebuilds the catalog',
    {
      setting: 'REIMPORT_DATABASE_URL',
      steps:
        'create a fresh database on the same server, migrate it ' +
        '(DATABASE_URL=<new-url> nub run db:migrate from apps/music-catalog), ' +
        'set REIMPORT_DATABASE_URL to it on the mbslave container and the ' +
        'worker, then restart both',
      runbook: 'apps/music-catalog/CLAUDE.md (Yearly schema change)',
    },
  );
};

// A crash here exits non-zero, so the compose restart brings the loop back:
// it resumes from mbslave's own cursor (`replication_control`), re-records
// the sequence and carries on.
if (restored) {
  if (reimportRestore !== undefined) {
    try {
      const reimportOutcome = await reimportRestore.maybeRestore();
      logger.info('Reimport restore done', { outcome: reimportOutcome });
    } catch (error) {
      logger.error('Parallel restore failed, the next start redoes it', {
        error,
      });
      process.exitCode = 1;
    }
  }
  try {
    const outcome = await replication.run(signal, bootstrap);
    logger.info('Replication done', { outcome });
  } catch (error) {
    logger.error('Replication failed, the next start resumes it', { error });
    await warnWhenReimportUnconfigured();
    process.exitCode = 1;
  } finally {
    await pool.end();
    await nextPool?.end();
  }
}

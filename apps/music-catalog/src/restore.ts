import { loadRestoreEnv, mbslaveSpawnEnv } from './config/env.js';
import { createDatabase, createPool } from './database/database.js';
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
import { ReplicationRepository } from './modules/replication/replication.repository.js';
import { ReplicationService } from './modules/replication/replication.service.js';
import { RecordingOutboxRepository } from './modules/sync/recording-outbox.repository.js';

// The process the mbslave container runs on start: it restores the
// MusicBrainz dump when needed, then replicates continuously in `full` mode
// (in `sample` mode replication stays off and the container exits). The
// worker takes it from `restored` to `ready`; replication itself waits for
// `ready`, so every packet reaches the outbox through the worker's triggers.
const env = loadRestoreEnv();
const logger = createLogger({
  name: 'restore',
  json: env.NODE_ENV === 'production',
});
const pool = createPool(env.DATABASE_URL, (error) => {
  logger.error('Database connection error', { error });
});
const db = createDatabase(pool);
const mbslaveRun = createProcessMbslaveRun(
  undefined,
  (line, args) => {
    logger.info('mbslave output', { command: args[0] ?? '', line });
  },
  mbslaveSpawnEnv(),
);
const restore = new RestoreService({
  repository: new BootstrapRepository(db),
  mbslave: new MbslaveClient(mbslaveRun),
  resolveUrls: resolveLatestDumpUrls,
  resolveTotalBytes: (urls) => fetchArchiveTotalBytes(urls),
  baseUrl: env.MUSICBRAINZ_DUMP_BASE_URL,
  dataset: env.CATALOG_DATASET,
  logger,
});
const replication = new ReplicationService({
  sequences: new ReplicationRepository(db),
  backlog: new RecordingOutboxRepository(db),
  mbslave: new MbslaveClient(mbslaveRun),
  dataset: env.CATALOG_DATASET,
  musicbrainzToken: env.MBSLAVE_MUSICBRAINZ_TOKEN,
  musicbrainzTokenFile: env.MBSLAVE_MUSICBRAINZ_TOKEN_FILE,
  logger,
});
const bootstrap = new BootstrapService(
  new BootstrapRepository(db),
  env.CATALOG_DATASET,
  replication,
);

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
  }
}

// A crash here exits non-zero, so the compose restart brings the loop back:
// it resumes from mbslave's own cursor (`replication_control`), re-records
// the sequence and carries on.
if (restored) {
  try {
    const outcome = await replication.run(signal, bootstrap);
    logger.info('Replication done', { outcome });
  } catch (error) {
    logger.error('Replication failed, the next start resumes it', { error });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

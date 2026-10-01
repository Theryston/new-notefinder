import { loadRestoreEnv } from './config/env.js';
import { createDatabase, createPool } from './database/database.js';
import {
  createProcessMbslaveRun,
  MbslaveClient,
} from './integrations/mbslave/mbslave-client.js';
import { createLogger } from './logger.js';
import { BootstrapRepository } from './modules/bootstrap/bootstrap.repository.js';
import { resolveLatestDumpUrls } from './modules/bootstrap/dump-urls.js';
import { RestoreService } from './modules/bootstrap/restore.service.js';

// The process the mbslave container runs on start: it restores the
// MusicBrainz dump when needed and exits, so the container is one-shot. The
// worker takes it from `restored` to `ready`.
const env = loadRestoreEnv();
const logger = createLogger({
  name: 'restore',
  json: env.NODE_ENV === 'production',
});
const pool = createPool(env.DATABASE_URL, (error) => {
  logger.error('Database connection error', { error });
});
const restore = new RestoreService({
  repository: new BootstrapRepository(createDatabase(pool)),
  mbslave: new MbslaveClient(createProcessMbslaveRun()),
  resolveUrls: resolveLatestDumpUrls,
  baseUrl: env.MUSICBRAINZ_DUMP_BASE_URL,
  dataset: env.CATALOG_DATASET,
  logger,
});

logger.info('Restore started', { dataset: env.CATALOG_DATASET });
try {
  const outcome = await restore.run();
  logger.info('Restore service done', { outcome });
} catch (error) {
  logger.error('Restore failed, the next start redoes it', { error });
  process.exitCode = 1;
} finally {
  await pool.end();
}

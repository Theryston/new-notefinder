import type { CatalogDataset } from '@vozzify/contracts';
import type { WorkerEnv } from './config/env.js';
import { withCatalogWriteLock } from './database/catalog-write-lock.js';
import type { Database } from './database/database.js';
import { databaseNameOf } from './database/database-ref.js';
import type { MeilisearchIndex } from './integrations/meilisearch/meilisearch-index.js';
import { createMeilisearchIndex } from './integrations/meilisearch/meilisearch-index.js';
import {
  RECORDINGS_INDEX,
  RECORDINGS_NEXT_INDEX,
  type RecordingDocument,
} from './lib/recordings-index.js';
import {
  REIMPORT_GENERATION_INDEX,
  REIMPORT_GENERATION_INDEX_SETTINGS,
  REIMPORT_GENERATION_NEXT_INDEX,
  type ReimportGenerationDocument,
} from './lib/reimport-generation-index.js';
import type { Logger } from './logger.js';
import { BootstrapRepository } from './modules/bootstrap/bootstrap.repository.js';
import { BootstrapService } from './modules/bootstrap/bootstrap.service.js';
import { IndexingRepository } from './modules/indexing/indexing.repository.js';
import { IndexingService } from './modules/indexing/indexing.service.js';
import { RecordingDocumentRepository } from './modules/recording/recording-document.repository.js';
import { RecordingDocumentService } from './modules/recording/recording-document.service.js';
import { DatabaseIdentityRepository } from './modules/reimport/database-identity.repository.js';
import {
  type ReimportCopy,
  ReimportService,
} from './modules/reimport/reimport.service.js';
import { ReimportStateRepository } from './modules/reimport/reimport-state.repository.js';
import { ReimportSwitchService } from './modules/reimport/reimport-switch.service.js';
import { ReplicationRepository } from './modules/replication/replication.repository.js';
import { RecordingOutboxRepository } from './modules/sync/recording-outbox.repository.js';
import { SyncService } from './modules/sync/sync.service.js';
import { TrackAssociationRepository } from './modules/track-association/track-association.repository.js';
import { TrackAssociationService } from './modules/track-association/track-association.service.js';

export type WorkerReimportOptions = {
  bootstrap: BootstrapService;
  state: ReimportStateRepository;
  dataset: CatalogDataset;
  logger: Logger;
  /** The serving copy's reads, flip-flopping on the cutover. */
  dbSource: () => Database;
  /** The serving copy's search indexes, swapped on the flip. */
  index: MeilisearchIndex<RecordingDocument>;
  env: WorkerEnv;
  /** The parallel database with its URL; absent, the worker never reimports. */
  nextCopy?: { db: Database; url: string };
};

/**
 * The worker's side of the reimport, assembled from the next database when
 * one is configured. Lives beside the composition root (not a feature
 * module): it only news up what the copy needs. The steps it wires are
 * covered by their own specs and the reimport e2e suite; this assembly is
 * covered by construction below.
 */
export const assembleWorkerReimport = (
  options: WorkerReimportOptions,
): ReimportService => {
  const { bootstrap, state, dataset, logger } = options;
  if (options.nextCopy === undefined) {
    return new ReimportService({ bootstrap, state, dataset, logger });
  }
  const { db: nextDb, url: nextUrl } = options.nextCopy;
  const { env, index } = options;
  return new ReimportService({
    bootstrap: options.bootstrap,
    state: options.state,
    dataset: options.dataset,
    copy: buildNextCopy({
      env,
      dbSource: options.dbSource,
      nextDb,
      nextUrl,
      index,
      logger: options.logger,
    }),
    logger: options.logger,
  });
};

type NextCopyParts = {
  env: WorkerEnv;
  dbSource: () => Database;
  nextDb: Database;
  nextUrl: string;
  index: MeilisearchIndex<RecordingDocument>;
  logger: Logger;
};

// The four steps against the parallel copy. Split from the assembly above
// so each function stays small; covered by the same construction spec.
const buildNextCopy = (parts: NextCopyParts): ReimportCopy => {
  const { env, nextDb, logger } = parts;
  const nextIndex = createMeilisearchIndex<RecordingDocument>({
    url: env.MEILISEARCH_URL,
    apiKey: env.MEILISEARCH_WRITE_API_KEY,
    ...RECORDINGS_NEXT_INDEX,
  });
  const generations = createGenerationIndexes(parts);
  const associationSync = new SyncService({
    bootstrap: new BootstrapService(
      new BootstrapRepository(nextDb),
      env.CATALOG_DATASET,
    ),
    outbox: new RecordingOutboxRepository(() => nextDb),
    documents: new RecordingDocumentService(
      new RecordingDocumentRepository(nextDb),
    ),
    index: nextIndex,
    batchSize: env.INDEXING_BATCH_SIZE,
    associations: new TrackAssociationService(
      new TrackAssociationRepository(nextDb),
    ),
    writeLock: <Result>(run: () => Promise<Result>) =>
      withCatalogWriteLock(nextDb, run),
    logger,
  });
  return {
    ensureTriggersCopy: async (): Promise<void> => {
      await generations.prepare(true);
      await new RecordingOutboxRepository(nextDb).ensureTriggers();
    },
    indexCopy: async (
      signal: AbortSignal,
      onProgress: (fraction: number) => Promise<void>,
    ): Promise<void> => {
      await detachedIndexing(parts, nextIndex).runDetached(signal);
      await associationSync.drainAssociations();
      await onProgress(1);
    },
    prepareSwitch: async () => {
      await generations.prepare(false);
      await associationSync.drainAssociations();
    },
    switchToCopy: buildSwitchStep(parts, nextIndex, generations),
  };
};

type GenerationIndexes = {
  serving: MeilisearchIndex<ReimportGenerationDocument>;
  next: MeilisearchIndex<ReimportGenerationDocument>;
  nextDatabaseOid: () => Promise<string>;
  prepare: (allowInitialServingMarker: boolean) => Promise<void>;
};

const createGenerationIndexes = (parts: NextCopyParts): GenerationIndexes => {
  const { env, dbSource, nextDb } = parts;
  const serving = createMeilisearchIndex<ReimportGenerationDocument>({
    url: env.MEILISEARCH_URL,
    apiKey: env.MEILISEARCH_WRITE_API_KEY,
    ...REIMPORT_GENERATION_INDEX,
  });
  const next = createMeilisearchIndex<ReimportGenerationDocument>({
    url: env.MEILISEARCH_URL,
    apiKey: env.MEILISEARCH_WRITE_API_KEY,
    ...REIMPORT_GENERATION_NEXT_INDEX,
  });
  const nextDatabaseOid = () => new DatabaseIdentityRepository(nextDb).getOid();
  return {
    serving,
    next,
    nextDatabaseOid,
    prepare: async (allowInitialServingMarker) => {
      await Promise.all([
        serving.ensure(REIMPORT_GENERATION_INDEX_SETTINGS),
        next.ensure(REIMPORT_GENERATION_INDEX_SETTINGS),
      ]);
      const [servingDatabaseOid, targetDatabaseOid, marker] = await Promise.all(
        [
          new DatabaseIdentityRepository(dbSource()).getOid(),
          nextDatabaseOid(),
          serving.getDocument('catalog'),
        ],
      );
      if (marker === undefined) {
        if (!allowInitialServingMarker) {
          throw new Error(
            'Cannot recover the reimport swap: serving generation marker is missing.',
          );
        }
        await serving.upsert([
          { id: 'catalog', databaseOid: servingDatabaseOid },
        ]);
      } else if (
        marker.databaseOid !== servingDatabaseOid &&
        marker.databaseOid !== targetDatabaseOid
      ) {
        throw new Error(
          'Cannot recover the reimport swap: serving generation marker ' +
            'matches neither database.',
        );
      }
      await next.upsert([{ id: 'catalog', databaseOid: targetDatabaseOid }]);
    },
  };
};

// The flip to the parallel copy. Split from the copy above so each function
// stays small; covered by the same construction spec.
const buildSwitchStep = (
  parts: NextCopyParts,
  nextIndex: MeilisearchIndex<RecordingDocument>,
  generations: GenerationIndexes,
): ReimportCopy['switchToCopy'] => {
  const { env, dbSource, nextDb, nextUrl, index, logger } = parts;
  return () =>
    new ReimportSwitchService({
      servingOutbox: new RecordingOutboxRepository(dbSource),
      servingState: new ReimportStateRepository(dbSource),
      nextState: new ReimportStateRepository(nextDb),
      sequences: new ReplicationRepository(dbSource),
      nextIndex,
      generation: {
        serving: async () => {
          const marker = await generations.serving.getDocument('catalog');
          if (marker === undefined) {
            throw new Error(
              'Cannot recover the reimport swap: marker is missing.',
            );
          }
          return marker.databaseOid;
        },
        next: generations.nextDatabaseOid,
        deleteNext: () => generations.next.deleteIndex(),
      },
      nextUrl,
      oldDatabaseName: databaseNameOf(env.DATABASE_URL),
      cleanupOldCopy: env.REIMPORT_CLEANUP_OLD_COPY !== 'false',
      swapBoth: () =>
        index.swapPairs([
          {
            servingUid: RECORDINGS_INDEX.uid,
            nextUid: RECORDINGS_NEXT_INDEX.uid,
          },
          {
            servingUid: REIMPORT_GENERATION_INDEX.uid,
            nextUid: REIMPORT_GENERATION_NEXT_INDEX.uid,
          },
        ]),
      // A rerun that finds the flip record completes the flip instead of
      // swapping back. Either copy's row proves it: the record is written
      // on both, and the reads may already point at the new copy.
      alreadySwitched: async () => {
        const state = await new ReimportStateRepository(dbSource).get();
        return state?.phase === 'switched' && state.detail === nextUrl;
      },
      logger,
    }).switchToCopy();
};

// The parallel copy's indexer: detached from the first import's phases (the
// reimport tracks its own state), writing the `*_next` indexes from the
// next database. Split from the copy above so each function stays small.
const detachedIndexing = (
  parts: NextCopyParts,
  nextIndex: MeilisearchIndex<RecordingDocument>,
): IndexingService => {
  const { env, nextDb, logger } = parts;
  return new IndexingService({
    bootstrap: new BootstrapService(
      new BootstrapRepository(nextDb),
      env.CATALOG_DATASET,
    ),
    documents: new RecordingDocumentService(
      new RecordingDocumentRepository(nextDb),
    ),
    repository: new IndexingRepository(nextDb),
    index: nextIndex,
    batchSize: env.INDEXING_BATCH_SIZE,
    logger,
    writeLock: <Result>(run: () => Promise<Result>) =>
      withCatalogWriteLock(nextDb, run),
  });
};

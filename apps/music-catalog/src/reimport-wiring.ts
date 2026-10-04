import type { CatalogDataset } from '@notefinder/contracts';
import type { WorkerEnv } from './config/env.js';
import type { Database } from './database/database.js';
import { databaseNameOf } from './database/database-ref.js';
import type { MeilisearchIndex } from './integrations/meilisearch/meilisearch-index.js';
import { createMeilisearchIndex } from './integrations/meilisearch/meilisearch-index.js';
import {
  LYRICS_INDEX,
  LYRICS_NEXT_INDEX,
  type LyricsDocument,
} from './lib/lyrics-index.js';
import {
  RECORDINGS_INDEX,
  RECORDINGS_NEXT_INDEX,
  type RecordingDocument,
} from './lib/recordings-index.js';
import type { Logger } from './logger.js';
import { BootstrapRepository } from './modules/bootstrap/bootstrap.repository.js';
import { BootstrapService } from './modules/bootstrap/bootstrap.service.js';
import { IndexingRepository } from './modules/indexing/indexing.repository.js';
import { IndexingService } from './modules/indexing/indexing.service.js';
import { LyricsRepository } from './modules/lyrics/lyrics.repository.js';
import { LyricsService } from './modules/lyrics/lyrics.service.js';
import { LyricsCarryoverService } from './modules/lyrics/lyrics-carryover.service.js';
import { RecordingDocumentRepository } from './modules/recording/recording-document.repository.js';
import { RecordingDocumentService } from './modules/recording/recording-document.service.js';
import {
  type ReimportCopy,
  ReimportService,
} from './modules/reimport/reimport.service.js';
import { ReimportStateRepository } from './modules/reimport/reimport-state.repository.js';
import { ReimportSwitchService } from './modules/reimport/reimport-switch.service.js';
import { ReplicationRepository } from './modules/replication/replication.repository.js';
import { RecordingOutboxRepository } from './modules/sync/recording-outbox.repository.js';

export type WorkerReimportOptions = {
  bootstrap: BootstrapService;
  state: ReimportStateRepository;
  dataset: CatalogDataset;
  logger: Logger;
  /** The serving copy's reads, flip-flopping on the cutover. */
  dbSource: () => Database;
  /** The serving copy's search indexes, swapped on the flip. */
  index: MeilisearchIndex<RecordingDocument>;
  lyricsIndex: MeilisearchIndex<LyricsDocument>;
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
  const { env, index, lyricsIndex } = options;
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
      lyricsIndex,
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
  lyricsIndex: MeilisearchIndex<LyricsDocument>;
  logger: Logger;
};

// How many of the parallel copy's ids the flip samples before swapping: a
// differing copy is missed only when every sampled id exists on both sides,
// so hundreds make a wrong skip vanishingly unlikely, while an identical
// copy is harmless to swap twice anyway.
const REIMPORT_SWAP_PROBE_SIZE = 200;

// The four steps against the parallel copy. Split from the assembly above
// so each function stays small; covered by the same construction spec.
const buildNextCopy = (parts: NextCopyParts): ReimportCopy => {
  const { env, dbSource, nextDb, logger } = parts;
  const nextIndex = createMeilisearchIndex<RecordingDocument>({
    url: env.MEILISEARCH_URL,
    apiKey: env.MEILISEARCH_WRITE_API_KEY,
    ...RECORDINGS_NEXT_INDEX,
  });
  const nextLyricsIndex = createMeilisearchIndex<LyricsDocument>({
    url: env.MEILISEARCH_URL,
    apiKey: env.MEILISEARCH_WRITE_API_KEY,
    ...LYRICS_NEXT_INDEX,
  });
  return {
    ensureTriggersCopy: async (): Promise<void> => {
      await new RecordingOutboxRepository(nextDb).ensureTriggers();
    },
    rematchLyrics: (signal: AbortSignal) =>
      new LyricsCarryoverService({
        source: new LyricsRepository(dbSource),
        target: new LyricsRepository(nextDb),
        logger,
      }).carryOver(signal),
    indexCopy: async (
      signal: AbortSignal,
      onProgress: (fraction: number) => Promise<void>,
    ): Promise<void> => {
      await detachedIndexing(parts, nextIndex, nextLyricsIndex).runDetached(
        signal,
      );
      await onProgress(1);
    },
    switchToCopy: buildSwitchStep(parts, nextIndex, nextLyricsIndex),
  };
};

// The flip to the parallel copy. Split from the copy above so each function
// stays small; covered by the same construction spec.
const buildSwitchStep = (
  parts: NextCopyParts,
  nextIndex: MeilisearchIndex<RecordingDocument>,
  nextLyricsIndex: MeilisearchIndex<LyricsDocument>,
): ReimportCopy['switchToCopy'] => {
  const { env, dbSource, nextDb, nextUrl, index, lyricsIndex, logger } = parts;
  return () =>
    new ReimportSwitchService({
      servingOutbox: new RecordingOutboxRepository(dbSource),
      servingState: new ReimportStateRepository(dbSource),
      nextState: new ReimportStateRepository(nextDb),
      sequences: new ReplicationRepository(dbSource),
      servingIndex: index,
      nextIndex,
      servingLyricsIndex: lyricsIndex,
      nextLyricsIndex,
      nextUrl,
      oldDatabaseName: databaseNameOf(env.DATABASE_URL),
      cleanupOldCopy: env.REIMPORT_CLEANUP_OLD_COPY !== 'false',
      // One Meilisearch task swaps both pairs: no half-swapped catalog
      // when the process dies mid-flip (see ReimportSwitchService).
      swapBoth: () =>
        index.swapPairs([
          {
            servingUid: RECORDINGS_INDEX.uid,
            nextUid: RECORDINGS_NEXT_INDEX.uid,
          },
          { servingUid: LYRICS_INDEX.uid, nextUid: LYRICS_NEXT_INDEX.uid },
        ]),
      // A rerun that finds the flip record completes the flip instead of
      // swapping back. Either copy's row proves it: the record is written
      // on both, and the reads may already point at the new copy.
      alreadySwitched: async () => {
        const state = await new ReimportStateRepository(dbSource).get();
        return state?.phase === 'switched' && state.detail === nextUrl;
      },
      // A sample of the parallel copy's ids: when the flip record is
      // missing but the serving index already holds them all, the swap ran
      // and the process died before recording it.
      swapProbe: async () =>
        (
          await new RecordingDocumentRepository(nextDb).findBatch(
            0,
            REIMPORT_SWAP_PROBE_SIZE,
          )
        ).map((row) => row.mbid),
      logger,
    }).switchToCopy();
};

// The parallel copy's indexer: detached from the first import's phases (the
// reimport tracks its own state), writing the `*_next` indexes from the
// next database. Split from the copy above so each function stays small.
const detachedIndexing = (
  parts: NextCopyParts,
  nextIndex: MeilisearchIndex<RecordingDocument>,
  nextLyricsIndex: MeilisearchIndex<LyricsDocument>,
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
    lyrics: {
      documents: new LyricsService(new LyricsRepository(nextDb)),
      index: nextLyricsIndex,
    },
    batchSize: env.INDEXING_BATCH_SIZE,
    logger,
  });
};

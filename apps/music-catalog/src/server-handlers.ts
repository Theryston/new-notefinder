import type { ServerEnv } from './config/env.js';
import type { Database } from './database/database.js';
import { createMeilisearchIndex } from './integrations/meilisearch/meilisearch-index.js';
import {
  RECORDINGS_INDEX,
  type RecordingDocument,
} from './lib/recordings-index.js';
import type { Logger } from './logger.js';
import { createGetArtistHandler } from './modules/artist/artist.handler.js';
import { ArtistRepository } from './modules/artist/artist.repository.js';
import { ArtistService } from './modules/artist/artist.service.js';
import { createStatusHandler } from './modules/bootstrap/bootstrap.handler.js';
import type { BootstrapService } from './modules/bootstrap/bootstrap.service.js';
import { createGetRecordingHandler } from './modules/recording/recording.handler.js';
import { RecordingRepository } from './modules/recording/recording.repository.js';
import { RecordingService } from './modules/recording/recording.service.js';
import { createGetReleaseGroupHandler } from './modules/release-group/release-group.handler.js';
import { ReleaseGroupRepository } from './modules/release-group/release-group.repository.js';
import { ReleaseGroupService } from './modules/release-group/release-group.service.js';
import { createSearchHandler } from './modules/search/search.handler.js';
import { SearchService } from './modules/search/search.service.js';
import { SearchReadiness } from './modules/search/search-readiness.js';
import { createTrackAssociationHandler } from './modules/track-association/track-association.handler.js';
import { TrackAssociationRepository } from './modules/track-association/track-association.repository.js';
import { TrackAssociationService } from './modules/track-association/track-association.service.js';
import type { Handler } from './ws/handler.js';

const SEARCH_READINESS_QUERY_TIMEOUT_MS = 5000;

export const createServerHandlers = (options: {
  bootstrap: BootstrapService;
  dbSource: () => Database;
  currentUrl: () => string;
  env: ServerEnv;
  nextCopy?: { db: Database; url: string };
  logger: Logger;
  refreshIntervalMs: number;
  onReadinessCreated?: (readiness: SearchReadiness) => void;
}): { handlers: Handler[]; readiness: SearchReadiness } => {
  const { bootstrap, dbSource, currentUrl, env, nextCopy, logger } = options;
  const readiness = new SearchReadiness({
    readPhase: (shouldContinue) =>
      bootstrap.getImportPhase({
        queryTimeoutMs: SEARCH_READINESS_QUERY_TIMEOUT_MS,
        shouldContinue,
      }),
    refreshIntervalMs: options.refreshIntervalMs,
    logger,
  });
  const search = new SearchService({
    readiness,
    index: createMeilisearchIndex<RecordingDocument>({
      url: env.MEILISEARCH_URL,
      apiKey: env.MEILISEARCH_SEARCH_API_KEY,
      ...RECORDINGS_INDEX,
    }),
  });
  const recording = new RecordingService(
    new RecordingRepository(dbSource),
    bootstrap,
  );
  const trackAssociations = createTrackAssociationHandler(
    new TrackAssociationService(
      new TrackAssociationRepository(dbSource, currentUrl, nextCopy),
    ),
  );
  options.onReadinessCreated?.(readiness);
  return {
    handlers: [
      createStatusHandler(bootstrap),
      createGetRecordingHandler(recording),
      createSearchHandler(search),
      trackAssociations,
      ...createEntityHandlers(dbSource, bootstrap),
    ],
    readiness,
  };
};

const createEntityHandlers = (
  dbSource: () => Database,
  bootstrap: BootstrapService,
): Handler[] => [
  createGetReleaseGroupHandler(
    new ReleaseGroupService(new ReleaseGroupRepository(dbSource), bootstrap),
  ),
  createGetArtistHandler(
    new ArtistService(new ArtistRepository(dbSource), bootstrap),
  ),
];

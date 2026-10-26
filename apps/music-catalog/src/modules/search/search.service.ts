import type {
  MusicCatalogSearchParams,
  MusicCatalogSearchResult,
} from '@notefinder/contracts';
import type { MeilisearchIndex } from '../../integrations/meilisearch/meilisearch-index.js';
import type { RecordingDocument } from '../../lib/recordings-index.js';
import type { RecordingSummaryService } from '../recording/recording-summary.service.js';
import { orderByIds } from './order-by-ids.js';
import type { SearchReadiness } from './search-readiness.js';

export type SearchServiceDeps = {
  readiness: SearchReadiness;
  /** Opened with the search-only key: this service never writes. */
  index: MeilisearchIndex<RecordingDocument>;
  summaries: RecordingSummaryService;
};

export class SearchService {
  constructor(private readonly deps: SearchServiceDeps) {}

  /**
   * Finds Recordings by metadata. The search engine picks the matches and
   * their order; Postgres, read once for the whole page, supplies what a
   * result shows, and the results come back exactly in the engine's order
   * (a match whose Recording has since left the database is dropped).
   * `CATALOG_NOT_READY` until the first import has finished.
   */
  async search(
    params: MusicCatalogSearchParams,
  ): Promise<MusicCatalogSearchResult> {
    this.deps.readiness.assertReady();
    const mbids = await this.deps.index.search(params.query, {
      limit: params.limit,
      offset: params.offset,
    });
    return this.byMbids(mbids);
  }

  private async byMbids(mbids: string[]): Promise<MusicCatalogSearchResult> {
    const summaries = await this.deps.summaries.findByMbids(mbids);
    return { results: orderByIds(mbids, summaries, (s) => s.mbid) };
  }
}

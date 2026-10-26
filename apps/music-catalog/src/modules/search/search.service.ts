import type {
  MusicCatalogSearchParams,
  MusicCatalogSearchResult,
} from '@notefinder/contracts';
import type { MeilisearchIndex } from '../../integrations/meilisearch/meilisearch-index.js';
import { coverArtUrl } from '../../lib/cover-art-url.js';
import {
  RECORDING_SEARCH_ATTRIBUTES,
  type RecordingDocument,
} from '../../lib/recordings-index.js';
import type { SearchReadiness } from './search-readiness.js';

export type SearchServiceDeps = {
  readiness: SearchReadiness;
  /** Opened with the search-only key: this service never writes. */
  index: MeilisearchIndex<RecordingDocument>;
};

export class SearchService {
  constructor(private readonly deps: SearchServiceDeps) {}

  /**
   * Finds Recordings by metadata and returns the display fields stored in
   * Meilisearch, preserving its relevance order without a search-time DB read.
   * `CATALOG_NOT_READY` until the first import has finished.
   */
  async search(
    params: MusicCatalogSearchParams,
  ): Promise<MusicCatalogSearchResult> {
    this.deps.readiness.assertReady();
    const documents = await this.deps.index.search(
      params.query,
      {
        limit: params.limit,
        offset: params.offset,
      },
      [...RECORDING_SEARCH_ATTRIBUTES],
    );
    return {
      results: documents.map((document) => ({
        mbid: document.mbid,
        title: document.title,
        artistCredit: document.artistCredit,
        coverUrl:
          typeof document.primaryReleaseMbid !== 'string'
            ? null
            : coverArtUrl(document.primaryReleaseMbid),
        trackId: document.trackId ?? null,
      })),
    };
  }
}

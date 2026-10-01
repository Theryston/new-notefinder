import type {
  MusicCatalogSearchParams,
  MusicCatalogSearchResult,
} from '@notefinder/contracts';
import type { MeilisearchIndex } from '../../integrations/meilisearch/meilisearch-index.js';
import type { LyricsDocument } from '../../lib/lyrics-index.js';
import type { RecordingDocument } from '../../lib/recordings-index.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { RecordingSummaryService } from '../recording/recording-summary.service.js';
import { orderByIds } from './order-by-ids.js';

export type SearchServiceDeps = {
  bootstrap: BootstrapService;
  /** Opened with the search-only key: this service never writes. */
  index: MeilisearchIndex<RecordingDocument>;
  summaries: RecordingSummaryService;
  /**
   * The `lyrics` index, opened with the same search-only key. Optional so
   * the specs written before Lyrics keep constructing the service without
   * it; the composition root always passes it, and without it the lyrics
   * scope answers no results.
   */
  lyricsIndex?: MeilisearchIndex<LyricsDocument>;
};

export class SearchService {
  constructor(private readonly deps: SearchServiceDeps) {}

  /**
   * Finds Recordings by free text. The search engine picks the matches and
   * their order; Postgres, read once for the whole page, supplies what a
   * result shows, and the results come back exactly in the engine's order
   * (a match whose Recording has since left the database is dropped).
   * `CATALOG_NOT_READY` until the first import has finished. The metadata
   * scope never matches on Lyrics: it only asks the metadata index, and the
   * lyrics scope only the Lyrics one.
   */
  async search(
    params: MusicCatalogSearchParams,
  ): Promise<MusicCatalogSearchResult> {
    await this.deps.bootstrap.assertReady();
    if (params.scope === 'lyrics') {
      return this.searchLyrics(params);
    }
    const mbids = await this.deps.index.search(params.query, {
      limit: params.limit,
      offset: params.offset,
    });
    return this.byMbids(mbids);
  }

  private async searchLyrics(
    params: MusicCatalogSearchParams,
  ): Promise<MusicCatalogSearchResult> {
    // Lyrics are not imported yet: no match is possible, and the metadata
    // index must not answer for them.
    if (this.deps.lyricsIndex === undefined) {
      return { results: [] };
    }
    const mbids = await this.deps.lyricsIndex.search(params.query, {
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

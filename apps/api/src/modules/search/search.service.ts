import { Injectable } from '@nestjs/common';
import type {
  MusicCatalogSearchParams,
  SearchResult,
} from '@notefinder/contracts';
import { MusicCatalogClient } from '../../integrations/music-catalog/music-catalog.client.js';

@Injectable()
export class SearchService {
  constructor(private readonly catalog: MusicCatalogClient) {}

  /**
   * Forwards the validated query to the Music catalog and returns its hits
   * in the catalog's order. `trackId` is always null in this slice: the
   * Track link arrives with issue #95, which looks every hit up in the
   * tracks table.
   */
  async search(params: MusicCatalogSearchParams): Promise<SearchResult> {
    const catalogResult = await this.catalog.search(params);
    return {
      results: catalogResult.results.map((result) => ({
        ...result,
        trackId: null,
      })),
    };
  }
}

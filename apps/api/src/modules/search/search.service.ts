import { Injectable } from '@nestjs/common';
import type {
  MusicCatalogSearchParams,
  SearchResult,
} from '@notefinder/contracts';
import { MusicCatalogClient } from '../../integrations/music-catalog/music-catalog.client.js';
import { TracksService } from '../tracks/tracks.service.js';

@Injectable()
export class SearchService {
  constructor(
    private readonly catalog: MusicCatalogClient,
    private readonly tracks: TracksService,
  ) {}

  /**
   * Forwards the validated query to the Music catalog and enriches each hit
   * with its Track id when notefinder already processed that Recording
   * (else null, which the web renders as a static card), keeping the
   * catalog's order.
   */
  async search(params: MusicCatalogSearchParams): Promise<SearchResult> {
    const catalogResult = await this.catalog.search(params);
    return {
      results: await this.tracks.attachTrackIds(catalogResult.results),
    };
  }
}

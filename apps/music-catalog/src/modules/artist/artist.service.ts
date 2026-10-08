import type { MusicCatalogArtist } from '@notefinder/contracts';
import { missingEntityError } from '../../errors/missing-entity-error.js';
import { votedGenres } from '../../lib/tag-votes.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { ArtistRepository } from './artist.repository.js';

const ARTIST_CODES = {
  label: 'artist',
  notFound: 'ARTIST_NOT_FOUND',
  moved: 'ARTIST_MOVED',
} as const;

export class ArtistService {
  constructor(
    private readonly repository: ArtistRepository,
    private readonly bootstrap: BootstrapService,
  ) {}

  /**
   * One artist by MBID, with its genres. Rejected with `CATALOG_NOT_READY`
   * until the first import finishes, `ARTIST_MOVED` (with the new MBID) for a
   * merged one, `ARTIST_NOT_FOUND` for an unknown one.
   */
  async getArtist(mbid: string): Promise<MusicCatalogArtist> {
    await this.bootstrap.assertReady();
    const row = await this.repository.findByMbid(mbid);
    if (row === undefined) {
      throw missingEntityError(
        ARTIST_CODES,
        mbid,
        await this.repository.findMergedInto(mbid),
      );
    }
    const votes = await this.repository.findTagVotes(row.id);
    return { mbid: row.mbid, name: row.name, genres: votedGenres(votes) };
  }
}

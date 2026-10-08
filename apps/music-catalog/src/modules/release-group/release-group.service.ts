import type { MusicCatalogReleaseGroup } from '@notefinder/contracts';
import { missingEntityError } from '../../errors/missing-entity-error.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import { assembleReleaseGroup } from './assemble-release-group.js';
import type { ReleaseGroupRepository } from './release-group.repository.js';
import { pickRepresentativeRelease } from './representative-release.js';

const RELEASE_GROUP_CODES = {
  label: 'release group',
  notFound: 'RELEASE_GROUP_NOT_FOUND',
  moved: 'RELEASE_GROUP_MOVED',
} as const;

export class ReleaseGroupService {
  constructor(
    private readonly repository: ReleaseGroupRepository,
    private readonly bootstrap: BootstrapService,
  ) {}

  /**
   * One release group by MBID, with its representative release. Rejected with
   * `CATALOG_NOT_READY` until the first import finishes, `RELEASE_GROUP_MOVED`
   * (with the new MBID) for a merged one, `RELEASE_GROUP_NOT_FOUND` for an
   * unknown one.
   */
  async getReleaseGroup(mbid: string): Promise<MusicCatalogReleaseGroup> {
    await this.bootstrap.assertReady();
    const row = await this.repository.findByMbid(mbid);
    if (row === undefined) {
      throw missingEntityError(
        RELEASE_GROUP_CODES,
        mbid,
        await this.repository.findMergedInto(mbid),
      );
    }
    const [artists, secondaryTypes, genres, releases] = await Promise.all([
      this.repository.findCreditedArtists(row.artistCreditId),
      this.repository.findSecondaryTypes(row.id),
      this.repository.findTagVotes(row.id),
      this.repository.findReleases(row.id),
    ]);
    const representative = pickRepresentativeRelease(releases);
    const media =
      representative === undefined
        ? []
        : await this.repository.findMedia(representative.id);
    return assembleReleaseGroup({
      row,
      artists,
      secondaryTypes,
      genres,
      releases,
      representative,
      media,
    });
  }
}
